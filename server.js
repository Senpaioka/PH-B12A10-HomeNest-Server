require('dotenv').config()
const express = require('express');
const app = express();
const cors = require('cors');
const port = process.env.PORT || 8808;

// middleware
app.use(cors());
app.use(express.json());

// actions
app.get('/', (req, res) => {
    res.send('HomeHest Server')
})


// listening 
app.listen(port, () => {
    console.log(`Server Running On Port: ${port}`);
})