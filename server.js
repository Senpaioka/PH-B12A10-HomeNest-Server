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

      const result = await property_collection.find({}, {projection: {propertyName: 1, price: 1, location: 1, image: 1, category: 1, price: 1, userId: 1} })
      .sort({ created_at: -1 }) 
      .toArray();
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



    app.delete('/properties/:propertyId', firebaseVerificationToken, async(req, res) => {

      try {
        const property_id = req.params.propertyId;
        const email = req.user.email || (await admin.auth().getUser(req.user.uid)).providerData[0].email;

        // validate ObjectId
        if (!ObjectId.isValid(property_id)) {
          return res.status(400).send({ message: "Invalid Property ID" })
        }

        // checking and filtering
        const filter = {
          _id: new ObjectId(property_id),
          userId: email, // only delete if the logged-in user owns it
        }

        // deleting the document
        const result = await property_collection.deleteOne(filter);

        // confirming delete
        if (result.deletedCount === 0) {
          return res.status(404).send({ message: "Deletion abort!" })
        }

        res.send({ message: "Property Deleted Successfully.", result});

      } catch (error) {
        console.error("Error deleting property:", error);
        res.status(500).send({ message: "Internal server error" });
      }

    })



    app.get('/my-submission', firebaseVerificationToken, async(req, res) => {

      const email = req.user.email || (await admin.auth().getUser(req.user.uid)).providerData[0].email;
      const query = {userId : email}
      const result = await property_collection.find(query).sort({ created_at: -1 }).toArray();
      res.send(result);
    })


    app.patch('/update/:propertyId', firebaseVerificationToken, async(req, res) => {

      try {
        const propertyId = req.params.propertyId;
        const updated_property = req.body;
        updated_property.created_at = new Date();
        const email = req.user.email || (await admin.auth().getUser(req.user.uid)).providerData[0].email;

        // validate input
        if (!ObjectId.isValid(propertyId)) {
          return res.status(400).send({message: "Invalid Property ID"});
        }

        // update operation
        const filter = {
          _id: new ObjectId(propertyId),
          userId: email, // user and document userId matching 
        }

        const update_doc = {
          $set: updated_property, // only update fields provided in req.body
        }

        // perform the update
        const result = await property_collection.updateOne(filter, update_doc);

        // handle response
        if (result.matchedCount === 0) {
          return res.status(404).send({ message: "Property Not Found." })
        }

        res.send({ message: "Property Information Updated!", result });

      }

      catch (error) {
        console.error("Error updating property:", error);
        res.status(500).send({ message: "Internal server error" });
      }
    })



    // FEEDBACK's API
    app.post('/feedback', firebaseVerificationToken, async(req, res) => {
      
      const newFeedback = req.body;
      const email = req.user.email || (await admin.auth().getUser(req.user.uid)).providerData[0].email;

      newFeedback.username = req.user.name;
      newFeedback.userId = email;
      newFeedback.created_at = new Date();
      const result = await feedback_collection.insertOne(newFeedback);
      res.send(result);

    });


    app.get('/feedback/:propertyId', async(req, res) => {

      const property_id = req.params.propertyId;

      const result = await feedback_collection.find(
      { propertyId: property_id },                  // Filter (use propertyId instead of _id)
      { projection: { userRating: 1, userComment: 1, username: 1, created_at: 1 } })
      .sort({ created_at: -1 }) 
      .toArray();

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