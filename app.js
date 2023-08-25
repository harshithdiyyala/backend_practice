const express = require("express");
const app = express();
app.use(express.json());

const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const path = require("path");

const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");

let db = null;

const dbPath = path.join(__dirname, "twitterClone.db");

const initializeDBAndServer = async () => {
  try {
    db = await open({ filename: dbPath, driver: sqlite3.Database });
    app.listen(3000, () => {
      console.log("Server is running on http://localhost:3000");
    });
  } catch (e) {
    console.log(`DB Error: ${e.message}`);
    process.exit(1);
  }
};
initializeDBAndServer();

//Middleware Function

const authenticateToken = (request, response, next) => {
  let authHeader = request.headers["authorization"];

  if (authHeader === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    let jwtToken = authHeader.split(" ")[1];

    if (jwtToken === undefined) {
      response.status(401);
      response.send("Invalid JWT Token");
    } else {
      jwt.verify(jwtToken, "MY_SECRET_KEY", (error, payload) => {
        if (error) {
          response.status(401);
          response.send("Invalid JWT Token");
        } else {
          request.username = payload.username;
          request.abc = authHeader;
          next();
        }
      });
    }
  }
};

//API 1 - registering the user

app.post("/register/", async (request, response) => {
  const { username, password, name, gender } = request.body;

  const getUsername = `SELECT username FROM user WHERE username = '${username}';`;

  const dbUsername = await db.get(getUsername);
  const HashedPassword = await bcrypt.hash(password, 10);

  if (dbUsername !== undefined) {
    response.status(400);
    response.send("User already exists");
  } else if (password.length < 6) {
    response.status(400);
    response.send("Password is too short");
  } else {
    const createUserQuery = `INSERT INTO user(username,password,name,gender)
        VALUES('${username}','${HashedPassword}','${name}','${gender}');`;

    await db.run(createUserQuery);

    response.send("User created successfully");
  }
});

//API 2 - login the user

app.post("/login/", async (request, response) => {
  const { username, password } = request.body;

  const getUsername = `SELECT username,password FROM user WHERE username = '${username}';`;

  const dbUser = await db.get(getUsername);

  if (dbUser === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const isPwdMatched = await bcrypt.compare(password, dbUser.password);
    console.log(isPwdMatched);
    if (isPwdMatched) {
      const jwtToken = jwt.sign({ username }, "MY_SECRET_KEY");
      console.log(jwtToken);
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});

//API 3 - Get latest tweets of People whom user follows

app.get("/user/tweets/feed/", authenticateToken, async (request, response) => {
  const { username } = request;

  const getLatestTweets = `SELECT (select username from user where user.user_id = tweet.user_id) as username,tweet,date_time as dateTime FROM
    (user JOIN follower on user.user_id = follower.follower_user_id) JOIN tweet 
    ON follower.following_user_id = tweet.user_id WHERE user.username = '${username}' 
    ORDER BY tweet_id DESC   LIMIT 4;`;

  let tweetsData = await db.all(getLatestTweets);

  response.send(tweetsData);
});

//API 4 - GET THE USERNAMES OF PEOPLE WHOM THE USER FOLLOWS

app.get("/user/following/", authenticateToken, async (request, response) => {
  const { username } = request;

  const getUserNameQuery = `SELECT (SELECT username from user WHERE user.user_id  = follower.following_user_id) as name from user JOIN follower ON user.user_id = follower.follower_user_id where username  =  '${username}';`;

  const usernameArray = await db.all(getUserNameQuery);

  response.send(usernameArray);
});

//API - 5 GET THE NAMES OF PEOPLE WHO FOLLOWS THE USER

app.get("/user/followers/", authenticateToken, async (request, response) => {
  const { username, abc } = request;
  console.log(abc);

  const getUserNameQuery = `SELECT (SELECT username from user WHERE user.user_id  = follower.follower_user_id) as name from user JOIN follower ON user.user_id = follower.following_user_id where username  =  '${username}';`;

  const usernameArray = await db.all(getUserNameQuery);

  response.send(usernameArray);
});
module.exports = app;
