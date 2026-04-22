require('dotenv').config(); 

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const Routes = require('./route/route');
const app = express();
const PORT = process.env.PORT || 3000;
  // Routes
   
// Middleware
app.use(cors());
app.use(express.json());

app.use('/api', Routes);
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB Connected"))
  .catch((err) => console.log(err))
    
  


    // Start server
    app.listen(PORT, () => {
        console.log(`🚀 Server running on port ${PORT}`);
      
    });


