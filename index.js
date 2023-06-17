const express = require("express");
const cors = require("cors");
require("dotenv").config();
const jwt = require("jsonwebtoken");
const stripe = require("stripe")(process.env.PAYMENT_SECRET_KEY);
const app = express();
const port = process.env.PORT || 5000;

//middleware
app.use(cors());
app.use(express.json());

const verifyJwt = (req, res, next) => {
  const authorization = req.headers.authorization;
  if (!authorization) {
    return res.status(401).send({ err: true, massage: "unauthorized access" });
  }
  // bearer token
  const token = authorization.split(" ")[1];

  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err) {
      return res
        .status(401)
        .send({ err: true, massage: "unauthorized access" });
    }
    req.decoded = decoded;
    next();
  });
};

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

    const instrucClassesCollection = client
      .db("eduLightDb")
      .collection("instrucClasses");
    const selectedClassCollection = client
      .db("eduLightDb")
      .collection("selectedClass");
    const usersCollection = client.db("eduLightDb").collection("users");
    const paymentCollection = client.db("eduLightDb").collection("payment");

    app.post("/jwt", (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "5h",
      });
      res.send(token);
    });

    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email };
      const user = await usersCollection.findOne(query);
      if (user?.role !== "admin") {
        return res
          .status(403)
          .send({ error: true, massage: "forbidden access" });
      }
      next();
    };

    //users related apis

    app.get("/users", verifyJwt, verifyAdmin, async (req, res) => {
      const result = await usersCollection.find().toArray();
      res.send(result);
    });

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

    app.get("/users/admin/:email", verifyJwt, async (req, res) => {
      const email = req.params.email;

      if (req.decoded.email !== email) {
        res.send({ admin: false });
      }

      const query = { email: email };
      const user = await usersCollection.findOne(query);
      const result = { admin: user?.role === "admin" };
      res.send(result);
    });

    // useInstructor
    app.get("/users/instructor/:email", verifyJwt, async (req, res) => {
      const email = req.params.email;

      if (req.decoded.email !== email) {
        res.send({ instructor: false });
      }

      const query = { email: email };
      const user = await usersCollection.findOne(query);
      const result = { instructor: user?.role === "instructor" };
      res.send(result);
    });

    // admin dashboard related apis----------------------
    app.patch("/users/admin/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          role: "admin",
        },
      };
      const result = await usersCollection.updateOne(filter, updateDoc);
      res.send(result);
    });

    app.patch("/users/instructor/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          role: "instructor",
        },
      };
      const result = await usersCollection.updateOne(filter, updateDoc);
      res.send(result);
    });

    app.get("/manageClass", verifyJwt, verifyAdmin, async (req, res) => {
      const result = await instrucClassesCollection.find().toArray();
      res.send(result);
    });

    app.patch("/manageClass/approve/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          status: "approve",
        },
      };
      const result = await instrucClassesCollection.updateOne(
        filter,
        updateDoc
      );
      res.send(result);
    });

    app.patch("/manageClass/deny/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          status: "deny",
        },
      };
      const result = await instrucClassesCollection.updateOne(
        filter,
        updateDoc
      );
      res.send(result);
    });

    app.patch("/manageClass/feedback/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          feedback: req.body.feedback,
        },
      };
      const result = await instrucClassesCollection.updateOne(
        filter,
        updateDoc
      );
      res.send(result);
    });

    //instrucClasses apis----------------------
    app.get("/instrucClasses", async (req, res) => {
      const query = { status: "approve" };
      const result = await instrucClassesCollection.find(query).toArray();
      res.send(result);
    });

    app.post("/instrucClasses", async (req, res) => {
      const newClass = req.body;
      console.log(newClass);
      const result = await instrucClassesCollection.insertOne(newClass);
      res.send(result);
    });

    // popular classes api----------------------
    app.get("/popularClasses", async (req, res) => {
      const query = {};
      const options = {
        sort: { students: -1 },
      };
      const cursor = instrucClassesCollection.find(query, options);
      const result = await cursor.toArray();
      res.send(result);
    });

    //selected class collection-------------------------

    app.get("/selectedClass", verifyJwt, async (req, res) => {
      const email = req.query.email;
      if (!email) {
        res.send([]);
        return;
      }

      const decodedEmail = req.decoded.email;
      if (email !== decodedEmail) {
        return res.status(403).send({ err: true, massage: "forbidden access" });
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

    //payment apis-------------------------------
    app.post("/create-payment-intent", verifyJwt, async (req, res) => {
      const { price } = req.body;
      const amount = parseInt(price * 100);
      const paymentIntents = await stripe.paymentIntents.create({
        amount: amount,
        currency: "usd",
        payment_method_types: ["card"],
      });
      res.send({
        clientSecret: paymentIntents.client_secret,
      });
    });

    app.post("/payment", verifyJwt, async (req, res) => {
      const payment = req.body;
      const insertResult = await paymentCollection.insertOne(payment);

      const query = {
        _id: { $in: payment.selectedClassItems.map((id) => new ObjectId(id)) },
      };
      const deleteResult = await selectedClassCollection.deleteMany(query);

      res.send({ insertResult, deleteResult });
    });

    app.get("/paymentHistory", verifyJwt, async (req, res) => {
      const email = req.query.email;
      if (!email) {
        res.send([]);
        return;
      }

      const decodedEmail = req.decoded.email;
      if (email !== decodedEmail) {
        return res.status(403).send({ err: true, massage: "forbidden access" });
      }

      const query = { email: email };
      const result = await paymentCollection
        .find(query)
        .sort({ date: -1 })
        .toArray();
      res.send(result);
    });

    //problem here--------------------------------

    app.get("/enrolledClass/:email", verifyJwt, async (req, res) => {
      const email = req.params.email;
      if (!email) {
        res.send([]);
        return;
      }

      const decodedEmail = req.decoded.email;
      if (email !== decodedEmail) {
        return res.status(403).send({ err: true, massage: "forbidden access" });
      }

      const query = { email: email };
      const result = await paymentCollection.find(query).toArray();
      res.send(result);
    });

    // instructor apis------------------------
    app.get("/myClass", verifyJwt, async (req, res) => {
      const email = req.query.email;
      if (!email) {
        res.send([]);
        return;
      }

      const decodedEmail = req.decoded.email;
      if (email !== decodedEmail) {
        return res.status(403).send({ err: true, massage: "forbidden access" });
      }

      const query = { email: email };
      const result = await instrucClassesCollection.find(query).toArray();
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
