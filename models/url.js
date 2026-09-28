const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const User = require("./user.js");


const UrlSchema = new Schema({
    url : {
        type : String,
        required : true,
    },
    clicks : {
        type : Number ,
        default : 0 ,
    },
   code: {
    type: String,
    required: true,
    unique: true,
    index: true
},
    date : Date,
    owner : {
        type : Schema.Types.ObjectId,
        required: true,
        ref : "User"
    }
});

const Url = mongoose.model("Url" , UrlSchema);

module.exports = Url;


