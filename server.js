// server.js
// where your node app starts
const {google} = require('googleapis'); // API library from https://github.com/google/google-api-nodejs-client
const sheets = google.sheets('v4');
const plus = google.plus('v1');

let userName; //name to pull from G+ data
let dataDeets; //data to pull from spreadsheet

// the process.env values are set in .env
//Credentials needed for API calls
const clientID = process.env.CLIENT_ID;
const clientSecret = process.env.CLIENT_SECRET;

var callbackURL = 'https://'+process.env.PROJECT_DOMAIN+'.glitch.me/login/google/return';
var scopes = ['https://www.googleapis.com/auth/spreadsheets.readonly',
              'https://www.googleapis.com/auth/plus.me'];
var oauth2Client = new google.auth.OAuth2(clientID, clientSecret, callbackURL);

var url = oauth2Client.generateAuthUrl({
  // 'online' (default) or 'offline' (gets refresh_token)
    // If you only need one scope you can pass it as a string
  scope: scopes,
  access_type: 'offline',
  prompt: 'select_account' //or could be 'consent' to define what access is given
});

// init project
var express = require('express');
var app = express();
var expressSession = require('express-session');

// cookies are used to save authentication
var bodyParser = require('body-parser');
var cookieParser = require('cookie-parser');
app.use(express.static('views'))
app.use(bodyParser.urlencoded({extended: true}));
app.use(cookieParser());
app.use(expressSession({ secret:'watchingmonkeys', resave: true, saveUninitialized: true }));

// index route
app.get('/', function(req, res) {
  res.sendFile(__dirname + '/views/index.html');
});

// on clicking "logoff" the cookie is cleared
app.get('/logoff',
  function(req, res) {
    console.log("Logging off")
    res.clearCookie('google-auth');
    res.redirect('/');
  }
);

app.get('/auth/google', function(req, res) {
  console.log("redirecting to ", url);
  res.redirect(url);
});

app.get('/login/google/return', function(req, res) {
    console.log("About to get token");
    oauth2Client.getToken(req.query.code, function (err, tokens) {
      // Tokens contains an access_token and a refresh_token if you set access type to offline. Save them.
      if (!err) {
        console.log("Setting credentials")
        
        let keys = Object.keys(tokens)
        console.log(keys)
        oauth2Client.setCredentials({
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token
          
        });
        res.redirect('/setcookie');
      } else {
        console.log("Error on getToken: " + err);
      }
    });
  }
);

// on successful auth, a cookie is set before redirecting
// to the success view
app.get('/setcookie',
  function(req, res) {
    console.log("Going to set the cookie");
    res.cookie('google-auth', new Date());
    res.redirect('/success');
  }
);

// if cookie exists, success. otherwise, user is redirected to index
app.get('/success',
  function(req, res) {
    console.log("success setting cookie");
    if(req.cookies['google-auth']) {
      console.log("Google auth");
      res.sendFile(__dirname + '/views/success.html');
    } else {
      console.log("Redirect to root");
      res.redirect('/');
    }
  }
);

app.get('/getData',
  function(req, res) {
    // Get Google+ details
    
    plus.people.get({
      userId: 'me',
      auth: oauth2Client
    }, function (err, response) {
      if (err) {
        console.log("Failed getting people: " + err);
        res.send("Failed to get from the people");
      } else { 
        console.log("got people");
        if(response.data.isPlusUser==true){
          userName = response.data.name.givenName;
        } else {
          userName = "Unknown Stranger";        
        }

        // Now get spreadsheet values
        var request = {
          // The ID of the spreadsheet to retrieve data from.
          spreadsheetId: process.env.SHEET_KEY,
          // The A1 notation of the values to retrieve.
          range: 'A1:I8', 
          auth: oauth2Client
        };
        sheets.spreadsheets.values.get(request, function(err, response) {
          debugger
          if (err) {
            console.log("Aww, man: " + err);
            res.send("An error occurred");
          } else {
            console.log(response.data.values)
            dataDeets = response.data.values;
            res.send([userName, dataDeets]);
            console.log(userName, dataDeets)
          }
        });
      }
    });
  }
);

// listen for requests :)
var listener = app.listen(process.env.PORT, function() {
  console.log('Your app is listening on port ' + listener.address().port);
});
