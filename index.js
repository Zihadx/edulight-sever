const express = require("express");
const cors = require("cors");
require("dotenv").config();
const app = express();
const port = process.env.PORT || 5000;

//middleware
app.use(cors());
app.use(express.json());

const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.4gdacpf.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    const instrucClassesCollection = client
      .db("eduLightDb")
      .collection("instrucClasses");
    const selectedClassCollection = client
      .db("eduLightDb")
      .collection("selectedClass");
    const usersCollection = client.db("eduLightDb").collection("users");

    //users related apis
    app.post("/users", async (req, res) => {
      const user = req.body;
      const query = { email: user.email };
      const existingUser = await usersCollection.findOne(query);
      if (existingUser) {
        return res.send({ massage: "User Already Existing" });
      }

      const result = await usersCollection.insertOne(user);
      res.send(result);
    });

    //instrucClasses apis
    app.get("/instrucClasses", async (req, res) => {
      const result = await instrucClassesCollection.find().toArray();
      res.send(result);
    });

    //selected class collection

    app.get("/selectedClass", async (req, res) => {
      const email = req.query.email;
      if (!email) {
        res.send([]);
        return;
      }
      const query = { email: email };
      const result = await selectedClassCollection.find(query).toArray();
      res.send(result);
    });

    app.post("/selectedClass", async (req, res) => {
      const classes = req.body;
      const result = await selectedClassCollection.insertOne(classes);
      res.send(result);
    });

    app.delete("/selectedClass/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await selectedClassCollection.deleteOne(query);
      res.send(result);
    });

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("eduLight is running");
});

app.listen(port, () => {
  console.log(`eduLight is running on port ${port}`);
});
