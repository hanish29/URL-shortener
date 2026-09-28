require("dotenv").config();

const express = require("express");
const app = express();
const path = require("path");
const mongoose = require('mongoose');
const Url = require("./models/url.js");
const codefn = require("./codeGenerate.js");
const methodOverride = require("method-override");
const session = require("express-session");
const flash = require("connect-flash");
const QR = require("qrcode");
const User = require("./models/user.js");
const passport = require("passport");
const LocalStrategy = require("passport-local");
const {isLoggedIn} = require("./middleware.js");
const {MongoStore} = require("connect-mongo");

app.use(methodOverride("_method"));

app.use(express.urlencoded({extended : true}));
app.use(express.static(path.join(__dirname , "public")));

app.set("view engine","ejs");
app.set("views",path.join(__dirname,"views"));

const sessionOptions = {
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,

    store: MongoStore.create({
        mongoUrl: process.env.MONGO_URL
    }),

    cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    maxAge: 1000 * 60 * 60 * 24 * 7
}
};

app.use(session(sessionOptions));
app.use(flash());
app.use(passport.initialize());
app.use(passport.session());
passport.use(new LocalStrategy(User.authenticate()));
passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

app.use((req,res,next)=>{
    res.locals.success = req.flash("success");
    res.locals.error = req.flash("error");
    res.locals.currUser = req.user;
    next();
})

main().then((res)=>{
    console.log("connected to DB");
}).catch((err)=>{
    console.log(err);
})

async function main(){
    await mongoose.connect(process.env.MONGO_URL);
}

const PORT = process.env.PORT || 3000 ;
app.listen(PORT , ()=>{
    console.log(`server is running on port ${PORT}` );
})

app.get("/url.srt",isLoggedIn, async (req,res)=>{
   // console.log(res.locals.currUser);
    let {Search} = req.query;
    let urls;
    if(!Search){
    urls = await Url.find({owner : req.user._id});
    }else{
    urls = await Url.find({
        owner : req.user._id 
        ,$or : [
        {url : { 
            $regex : Search 
        }},
        {
            code : {
                $regex : Search
            }
        }
    ]});
}
    return res.render("home.ejs" , {
        urls , 
        Search
    });
    
})

app.get("/form",isLoggedIn,(req,res)=>{
    res.render("new.ejs");
})

app.post("/form",isLoggedIn,async (req,res)=>{
    let {url} = req.body;
    url = url.trim();
    if(!url){
        req.flash("error","URL cannot be empty !");
        return res.redirect("/form");
    }
    if(!url.startsWith("http://") && !url.startsWith("https://")){
        url = "https://" + url;
    }

    try{
        new URL(url);
    }catch(err){
        req.flash("error", "Please enter a valid URL.");
        return res.redirect("/form");
    }

    let existUrl = await Url.findOne({
        url : url ,
        owner : req.user._id
    });
    if(existUrl){
        const shortUrl = `${req.protocol}://${req.get("host")}/${existUrl.code}`;
        req.flash("success", `URL already exists! . Short Url : ${shortUrl}`);
       return res.redirect("/url.srt");
    }

    let code;
    do{
        code = codefn();
    }while(
        await Url.findOne({code : code})
    );
    await Url.insertOne({url : url , code : code , date : Date.now() , owner : req.user._id});
    res.redirect("/url.srt");
})


app.get("/edit/:id",isLoggedIn, async (req,res)=>{
    let {id} = req.params;
    if(!mongoose.Types.ObjectId.isValid(id)){
        return res.status(404).send("Invalid URL ID");
    }
    let url = await Url.findOne({
        _id : id ,
        owner : req.user._id,
    });
    if(!url){
        return res.status(404).send("URL not found");
    }
    res.render("edit.ejs",{url});
});

app.put("/edit/:id",isLoggedIn,async (req,res)=>{
    let {id} = req.params;
    let {link} = req.body;
    if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(404).send("Invalid URL ID");
    }

    link = link.trim();

    if (!link) {
        req.flash("error", "URL cannot be empty.");
        return res.redirect(`/edit/${id}`);
    }

    if(!link.startsWith("https://") && !link.startsWith("http://")){
        link = "https://" + link;
    }

    try {
        new URL(link);
    } catch (err) {
        req.flash("error", "Please enter a valid URL.");
        return res.redirect(`/edit/${id}`);
    }

    const updated =  await Url.findOneAndUpdate(
        {_id : id,
        owner : req.user._id,},
        {
            url : link,
        },
        {
            new : true,
        });
        if(!updated){
         return res.status(404).send("URL not found");
        }
        req.flash("success", "URL updated successfully!");
        res.redirect("/url.srt");
    
})

app.delete("/url.srt/:id",isLoggedIn,async (req,res)=>{
    let {id} = req.params;
    if(!mongoose.Types.ObjectId.isValid(id)){
    return res.status(404).send("Invalid URL ID");
    }
    const deleted = await Url.findOneAndDelete(
        {
            _id : id,
            owner : req.user._id,
        },
    );
    if(!deleted){
        return res.status(404).send("Page not found");
    }
    req.flash("success", "URL deleted successfully!");
    res.redirect("/url.srt");
})

app.get("/url.srt/:id",isLoggedIn ,async (req,res)=>{

    let {id} = req.params;
    if(!mongoose.Types.ObjectId.isValid(id)){
    return res.status(404).send("Invalid ID");
    }
    const url = await Url.findOne({
        _id : id,
        owner : req.user._id,
    });
    if (!url) {
        return res.status(404).send("Page not found");
    }
    res.render("show.ejs" , {url});
    
})

app.get("/qr/:code",async (req,res)=>{
    try{
        let {code} = req.params;
        const url = await Url.findOne({ code });
        if(!url){
            return res.status(404).send("Page not found");
        }
        const shortUrl = `${req.protocol}://${req.get("host")}/${code}`;
        const qr = await QR.toDataURL(shortUrl);
        return res.render("qr.ejs",{qr,url});
    }catch(err){
        console.log(err);
    }
});

app.get("/login" , async (req,res)=>{
    res.render("login.ejs");
})
app.post("/login" , passport.authenticate("local",{
    successRedirect : "/url.srt",
    failureRedirect : "/login",
    failureFlash: true
}));


app.get("/signup" , async (req,res)=>{
    res.render("signup.ejs");
})

app.post("/signup", async (req, res, next) => {
    try {
        let { username, password } = req.body;

        let newUser = new User({
            username: username,
        });

        let registeredUser = await User.register(newUser, password);

        req.login(registeredUser, (err) => {
            if (err) {
                return next(err);
            }

            req.flash("success", "Welcome to URL Shortener!");
            res.redirect("/url.srt");
        });

    } catch (err) {
        console.error(err);
        
         req.flash("error", "Username already exists");
        res.redirect("/signup");
    }
});

app.get("/logout" , async (req,res,next)=>{
    req.logout((err)=>{
        if(err) return next(err);
        res.redirect("/url.srt");
    });
})

app.get("/:code",async (req,res)=>{
    try{
        let {code} = req.params;
    let newurl = await Url.findOne({code : code});
    if (!newurl) {
            return res.status(404).send(`URL not found`);
    }else{
       const updatedUrl = await Url.findOneAndUpdate(
    { code: req.params.code },
    { $inc: { clicks: 1 } },
    { new: true }
);

if (!updatedUrl) {
    return res.status(404).send("URL not found");
}

res.redirect(updatedUrl.url);
    }
        
    }catch(err){
        console.log(err);
    }
});


// app.use((req, res) => {
//     res.status(404).send("Page not found");
// });

app.use((err, req, res, next) => {
    console.error(err);

    if (res.headersSent) {
        return next(err);
    }

    res.status(500).send("Something went wrong. Please try again.");
});


