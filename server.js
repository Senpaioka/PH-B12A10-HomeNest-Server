const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const admin = require("firebase-admin");
require('dotenv').config()
const express = require('express');
const app = express();
const cors = require('cors');
const uri = process.env.MONGODB_URI;
const port = process.env.PORT || 8808;


// firebase setup
const serviceAccount = require("./homenest-firebase-adminsdk-secret-key.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});


// middleware
app.use(cors());
app.use(express.json());


// custom firebase middleware
const firebaseVerificationToken = async (req, res, next) => {
  const authorization = req.headers.authorization;

  if (!authorization) {
    return res.status(401).send({
      message: "unauthorized access. Token not found!",
    });
  }

  const token = authorization.split(" ")[1];

  try {
    const decode = await admin.auth().verifyIdToken(token);
    req.user = decode;

    // continue
    next();

  } catch (error) {
    res.status(401).send({
      message: "unauthorized access.",
    });
  }
};



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
    const property_collection = database.collection('properties');
    const feedback_collection = database.collection('feedback');

    
    
    // USER's API
    app.post('/user', firebaseVerificationToken, async(req, res) => {
        const newUser = req.body;
        const email = req.body.email;
        const query = {email : email};
        const isUserAlreadyExists = await user_collection.findOne(query);
        
        if (isUserAlreadyExists) {
            res.send({ message: 'user already exits' })
        } else {
            newUser.created_at = new Date();
            const result = await user_collection.insertOne(newUser);
            res.send(result);
        }
    });




    // PROPERTY's API
    app.post('/properties', firebaseVerificationToken, async(req, res) => {

      const newProperty = req.body;
      const email = req.user.email || (await admin.auth().getUser(req.user.uid)).providerData[0].email;
      const username = req.user.displayName;
      
      newProperty.username = username;
      newProperty.userId = email;
      newProperty.created_at = new Date();
      
      // saving to database
      const result = await property_collection.insertOne(newProperty);
      res.send(result);
    });


    app.get('/properties', async(req, res) => {

      const result = await property_collection.find({}, {projection: {propertyName: 1, price: 1, location: 1, image: 1, category: 1, price: 1, userId: 1} }).toArray();
      res.send(result);

    })


    app.get('/properties/:propertyId', firebaseVerificationToken, async(req, res) => {
      
      // getting property info
      const property_id = req.params.propertyId;
      const params = { _id: new ObjectId(property_id) };
      const property = await property_collection.findOne(params);

      // getting user info
      const user = await user_collection.findOne({ email: property.userId });

      // combined both result
      const result = {
        ...property,
        userInfo: user || null,
      };

      res.send(result);

    })


    app.get('/my-submission', firebaseVerificationToken, async(req, res) => {

      const email = req.user.email || (await admin.auth().getUser(req.user.uid)).providerData[0].email;
      const query = {userId : email}
      const result = await property_collection.find(query).toArray();
      res.send(result);
    })



    // FEEDBACK's API
    app.post('/feedback', firebaseVerificationToken, async(req, res) => {
      
      const newFeedback = req.body;
      const email = req.user.email || (await admin.auth().getUser(req.user.uid)).providerData[0].email;

      newFeedback.userId = email;
      newFeedback.created_at = new Date();
      const result = await feedback_collection.insertOne(newFeedback);
      res.send(result);

    });




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