// Require the Express Module
var express = require('express');

var cookieParser = require('cookie-parser');
var session = require('express-session');

// Require the Mongoose Module
var mongoose = require('mongoose');

// Create an Express App
var app = express();

app.use(cookieParser());
app.use(
    session({
        secret: "message_board_secret",
        resave: true,
        saveUninitialized: true,
        cookie: { maxAge: 600000 }
    })
);

// Require body-parser (to receive post data from clients)
var bodyParser = require('body-parser');

var moment = require('moment');

// Integrate body-parser with our App
app.use(bodyParser.urlencoded({ extended: true }));

// Require path
var path = require('path');

// Setting our Static Folder Directory
app.use(express.static(path.join(__dirname, './static')));

// Setting our Views Folder Directory
app.set('views', path.join(__dirname, './views'));

// Setting our View Engine set to EJS
app.set('view engine', 'ejs');

mongoose.connect('mongodb://localhost/message_dashboard');

// define Schema variable
var Schema = mongoose.Schema;

var UserSchema = new mongoose.Schema({
    name:  { type: String, required: [true, "Username is required"], minlength: [3, "Username must be at least 3 characters long"] },
    _messages: [{type: Schema.Types.ObjectId, ref: 'Message'}],
    _comments: [{type: Schema.Types.ObjectId, ref: 'Comment'}]
}, {timestamps: true });

var MessageSchema = new mongoose.Schema({
    text: {type: String, required: [true, "Message is required"], minlength: [4, "Message must be at least 4 characters long"] },
    _user: {type: Schema.Types.ObjectId, ref: 'User'},
    _comments: [{type: Schema.Types.ObjectId, ref: 'Comment'}]
}, {timestamps: true });

// define Comment Schema
var CommentSchema = new mongoose.Schema({
    text: {type: String, required: [true, "Comment is required"], minlength: [4, "Comment must be at least 4 characters long"] },
    _user: {type: Schema.Types.ObjectId, ref: 'User'},
    _message: {type: Schema.Types.ObjectId, ref: 'Message'}
}, {timestamps: true });

// set our models by passing them their respective Schemas
mongoose.model('User', UserSchema);
mongoose.model('Message', MessageSchema);
mongoose.model('Comment', CommentSchema);

// store our models in variables
var User = mongoose.model('User');
var Message = mongoose.model('Message');
var Comment = mongoose.model('Comment');

// Routes
// Root Request
app.get('/', function(req, res) {
    console.log('Logging in: '+req.session.user_id);
    if(req.session.user_id){
        User.findOne({ _id: req.session.user_id }, function(err, user) {         
            if(err || !user) {
                res.render('index', err);
            }else{
                res.redirect('/board');
            }
        });
    } else {
        var err = req.query.err;
        if(err) res.render('index', {error: err.split(':')[2]});
        else res.render('index');
    }
});

app.get('/logout', function(req, res){
    req.session.user_id = '';
    req.session.user_name = '';

    res.redirect('/');
});

app.post('/login', function(req, res) {
    User.findOne({ name: req.body.name }, function(err, user) {
        if(err || !user) {
            var user = new User({ name: req.body.name });
            user.save(function(err) {
                if(err) {
                    console.log('Trouble adding a new user.');
                    res.redirect('/?err=' + err);
                } else {
                    req.session.user_id = user._id;
                    req.session.user_name = user.name;

                    res.redirect('/board');
                }
            });
        } else {
            req.session.user_id = user._id;
            req.session.user_name = user.name;

            res.redirect('/board');
        }
    });
});

app.get('/board', function(req, res){
    
    res.locals.user_name = req.session.user_name;

    if(!req.session.user_id){
        res.redirect('/');
    }else{

        var populateQuery = [{path:'_user', select:'name'}, {path:'_comments', populate: {path:'_user', model: 'User'}}];
        
        Message.find({}).sort({ createdAt: -1 }).populate(populateQuery)
            .exec(function(err, messages) {
                if(err){
                    res.render('board', { errors: err });
                }else{
                    var err = req.query.err;
                    if(err) err = err.split(':')[2];
                    res.render('board', { messages: messages, error: err });
                }
        });
    }
});

app.post('/submit_message', function(req, res) {
    User.findOne({ _id: req.session.user_id }, function(err, user) {
        if(err || !user) {
            console.log('something went wrong finding the user '+user);
            res.redirect('/board?err=' + err);
            // res.redirect('/board');
        }else{
            var message = new Message({ text: req.body.message });

            message._user = user._id;
            user._messages.push(message);

            message.save(function(err) {
                if(err) {
                    console.log('Something went wrong with message.save');
                    res.redirect('/board?err=' + err);
                    // res.redirect('/board');
                } else {
                    user.save(function(err){
                        if(err) { 
                            console.log('Error'); 
                        } else { 
                            console.log('successfully saved message to user!');
                            res.redirect('/board');
                        }
                    });
                }
            });
        }
    });
});

app.post('/submit_comment', function(req, res) {

    User.findOne({ _id: req.session.user_id }, function(err, user) {
        if(err || !user) {
            console.log('something went wrong finding the user '+user);
            res.redirect('/board?err=' + err);
            // res.redirect('/board');
        }else{
            Message.findOne({ _id: req.body.message_id }, function(err, message) {
                if(err || !message) {
                    console.log('something went wrong finding the message '+message);
                    res.redirect('/board');
                }else{
                    console.log(message);

                    var comment = new Comment({ text: req.body.comment });

                    comment._user = user._id;
                    comment._message = message._id;

                    user._comments.push(comment);
                    message._comments.push(comment);
        
                    comment.save(function(err) {
                        if(err) {
                            console.log('Something went wrong with comment.save');
                            res.redirect('/board?err=' + err);
                            // res.redirect('/board');
                        } else {
                            user.save(function(err){
                                if(err) { 
                                    console.log('Error saving comment to user');
                                    res.redirect('/board');
                                } else { 
                                    console.log('successfully saved comment to user!');
                                }
                            });
                            message.save(function(err){
                                if(err) { 
                                    console.log('Error saving comment to message');
                                    res.redirect('/board');
                                } else { 
                                    console.log('successfully saved comment to message!');
                                    res.redirect('/board');
                                }
                            });
                        }
                    });
                }
            });
        }
    });
});

// Setting our Server to Listen on Port: 8000
app.listen(8000, function() {
    console.log("listening on port 8000");
});