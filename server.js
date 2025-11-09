const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
require('dotenv').config()
const express = require('express');
const app = express();
const cors = require('cors');
const uri = process.env.MONGODB_URI;
const port = process.env.PORT || 8808;


// middleware
app.use(cors());
app.use(express.json());

// actions
app.get('/', (req, res) => {
    res.send('HomeHest Server')
})

// MongoDB
// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});


async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();
    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");

    // database setup
    const database = client.db('home_nest_db');
    const user_collection = database.collection('users');

    // USER's API
    app.post('/user', async(req, res) => {
        
    })

  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);


// listening 
app.listen(port, () => {
    console.log(`Server Running On Port: ${port}`);
})