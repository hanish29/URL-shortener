const mongoose = require('mongoose');
const Url = require("../models/url.js");
const datas = require("./data.js");
let codefn = require("../codeGenerate.js");

main().then((res)=>{
    console.log("connected to DB");
}).catch((err)=>{
    console.log(err);
})

async function main(){
    await mongoose.connect('mongodb://127.0.0.1:27017/URL_Shortener');
}

const init = async ()=>{
    await Url.deleteMany({});
    for(let data of datas){
        let newcode;
    do{
        newcode = codefn();
    }while(
        await Url.findOne({code : newcode})
    );
        await Url.insertOne({url : data.url , code : newcode , date : Date.now()});
    }
}

init();