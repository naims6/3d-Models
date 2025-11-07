const express = require("express");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
require("dotenv").config();
const app = express();
const port = 3000;
const admin = require("firebase-admin");
const serviceAccount = require("./firebase_token.json");

// middleware
const cors = require("cors");
app.use(cors());
app.use(express.json());

// connect with mongodb
const uri = `mongodb+srv://${process.env.USER_DB}:${process.env.USER_DB_PASS}@cluster0.wsfcvqt.mongodb.net/?appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const verifyFirebaseToken = async (req, res, next) => {
  const authorization = req.headers.authorization;
  const token = authorization.split(" ")[1];

  if (!token) {
    return res.status(401).send({ message: "Unauthorize Access" });
  }

  try {
    const decode = await admin.auth().verifyIdToken(token);
    if (req.query.email !== decode.email) {
      return res.status(403).send({ message: "Forbidden" });
    } else {
      next();
    }
  } catch {
    console.log("Big error here");
    return res.status(401).send({ message: "Unauthorize Access" });
  }
};

async function run() {
  try {
    // await client.connect();
    const database = client.db("3dCollection");
    const models = database.collection("models");
    const downloads = database.collection("downloads");

    app.get("/latest-models", async (req, res) => {
      const cursor = models.find().sort({ created_at: -1 }).limit(6);
      console.log(cursor);
      const result = await cursor.toArray();
      res.send(result);
    });

    app.get("/models", async (req, res) => {
      const cursor = models.find();
      const result = await cursor.toArray();
      res.send(result);
    });

    app.get("/download/:id", async (req, res) => {
      const { id } = req.params;
      const query = { _id: new ObjectId(id) };
      const result = await downloads.findOne(query);
      res.send(result);
    });

    app.get("/models/:id", async (req, res) => {
      const { id } = req.params;
      const query = { _id: new ObjectId(id) };
      const result = await models.findOne(query);
      res.send(result);
    });

    app.get("/my-downloads", verifyFirebaseToken, async (req, res) => {
      const email = req.query.email;
      const query = { downloaded_by: email };
      const result = await downloads.find(query).toArray();
      res.send(result);
    });

    app.post("/downloads/:id", async (req, res) => {
      const newDownload = req.body;
      const { id } = req.params;
      const result = await downloads.insertOne(newDownload);
      const query = { _id: new ObjectId(id) };
      const update = {
        $inc: { downloads: 1 },
      };
      const downloadCounted = await models.updateOne(query, update);
      res.send({ result, downloadCounted });
    });

    app.post("/models", async (req, res) => {
      const newModel = req.body;
      console.log(newModel);
      const result = await models.insertOne(newModel);
      res.send(result);
    });

    app.delete("/models/:id", async (req, res) => {
      const { id } = req.params;
      const query = { _id: new ObjectId(id) };
      const result = await models.deleteOne(query);
      res.send(result);
    });
    app.delete("/downloads/:id", async (req, res) => {
      const { id } = req.params;
      const query = { _id: new ObjectId(id) };
      const result = await downloads.deleteOne(query);
      res.send(result);
    });

    app.put("/models/:id", async (req, res) => {
      const { id } = req.params;
      const updatedModel = req.body;
      const update = { $set: updatedModel };
      const query = { _id: new ObjectId(id) };
      const result = await models.updateOne(query, update);
      res.send(result);
    });

    app.get("/my-models", verifyFirebaseToken, async (req, res) => {
      const email = req.query.email;
      const query = { created_by: email };
      const cursor = models.find(query);
      const result = await cursor.toArray();
      res.send(result);
    });

    app.get("/search", async (req, res) => {
      const search = req.query.search;
      const query = { name: { $regex: search, $options: "i" } };
      const result = await models.find(query).toArray();
      res.send(result);
    });

    //    send ping for testing
    // await client.db("admin").command({ ping: 1 });
    // console.log("Pinged your deployment");
  } finally {
  }
}

run().catch(console.dir);

app.listen(port, () => {
  console.log("Server in running", port);
});
