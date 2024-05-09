import express from "express";
const app = express();
import cors from "cors";
import crypto from "crypto";
import jwt from "jsonwebtoken";
const port = process.env.PORT || 3001;

app.use(express.json());
app.use(cors());
app.use(express.urlencoded({ extended: true }));

import mysql from "mysql2";

// Secret key for JWT
const JWT_SECRET = "quiza_kalpa_app"; // Replace with your secret key

// connecting Database
const connection = mysql.createPool({
  host: "kuisapp-db.cryue2wawy52.eu-north-1.rds.amazonaws.com",
  user: "admin",
  password: "be73VRvB6lbsnrrnoddT",
  database: "quiza_app",
});

// Hash a password using SHA-256
const hashPassword = (password) => {
  const hash = crypto.createHash("sha256");
  hash.update(password);
  return hash.digest("hex");
};

// Generate JWT token
const generateToken = (userId) => {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: "5h" });
};

// Middleware to verify JWT token
const verifyToken = (req, res, next) => {
  const token = req.headers.authorization && req.headers.authorization.split(" ")[1];
  if (!token) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  jwt.verify(token, JWT_SECRET, async (err, decoded) => {
    if (err) {
      return res.json({ message: "token expired" });
    }
    req.userId = decoded.userId;
    const query = `SELECT * from users WHERE id = ${req.userId}`;
    try {
      const data = await connection.promise().query(query);
      const username = data[0][0].username;
      const trimmedEmail = data[0][0].email;
      const hash = crypto.createHash("sha256").update(trimmedEmail).digest("hex");

      if (data[0].length === 0) {
        return res.status(400).json({ message: "Invalid userId" });
      }

      res.status(202).json({ username: username, image: hash });
    } catch (err) {
      res.status(500).json({ message: err });
    }
    next();
  });
};

app.post("/login", async (req, res) => {
  const postData = req.body;
  const usernamee = postData.username;
  const password = postData.password;

  // Hash the provided password
  const hashedPassword = hashPassword(password);

  const query = `SELECT id,email,username from users WHERE username = ? AND password = ?`;

  try {
    const data = await connection.promise().query(query, [usernamee, hashedPassword]);

    if (data[0].length === 0) {
      return res.status(400).json({ message: "Invalid username or password" });
    }
    const trimmedEmail = data[0][0].email;
    const hash = crypto.createHash("sha256").update(trimmedEmail).digest("hex");

    const userId = data[0][0].id;
    const username = data[0][0].username;

    const token = generateToken(userId);

    res.status(202).json({ token: token, username: username, image: hash });
  } catch (err) {
    res.status(500).json({ message: err });
  }
});

app.post("/create-user", async (req, res) => {
  const postData = req.body;
  const username = postData.username;
  const password = postData.password;
  const email = postData.email;

  // Hash the provided password
  const hashedPassword = hashPassword(password);

  const query = `INSERT INTO users (email,username,password) VALUES ('${email}','${username}','${hashedPassword}')`;

  try {
    await connection.promise().query(query);
    res.status(202).json({ status: true });
  } catch (err) {
    res.status(500).json({ message: err });
  }
});

app.post("/get-quizlist", async (req, res) => {
  const category_name = req.body.cat_name;

  const query = `SELECT 
            q.id AS quiz_id,
	          q.quiz_name AS quiz_name,
            q.description AS quiz_description
          FROM 
	          quizs q
          JOIN
            quize_category qc
          ON
            q.category_id = qc.id
          WHERE
            qc.category_name = '${category_name}'`;
  try {
    const data = await connection.promise().query(query);
    res.status(202).json({ data });
  } catch (err) {
    res.status(500).json({ message: err });
  }
});

app.post("/get-quiz", async (req, res) => {
  const id = req.body.id;

  const query = `SELECT 
      q.id AS QuestionID,
      q.question AS QuestionText,
      CONCAT(
        '{',
        GROUP_CONCAT(
          CONCAT(
            '"', 
            a.answer, 
            '": "', 
            a.id, 
            '"'
          )
          SEPARATOR ','
        ),
        '}'
      ) AS Answers,
      q.answer AS AnswerId
    FROM
      questions q
    JOIN 
      quizs z ON q.quize_id = z.id
    JOIN
      answers a ON q.id = a.question_id
    JOIN
      answers b ON q.answer = b.id
    WHERE 
      z.id = ${id}
    GROUP BY
      q.id, q.question, q.answer;`;

  try {
    const data = await connection.promise().query(query);
    res.status(202).json({ data });
  } catch (err) {
    res.status(500).json({ message: err });
  }
});

// Protected route example
app.get("/protected", verifyToken, (req, res) => {
  //res.status(200).json({ message: "valid", userId: req.body.id });
});

app.listen(port, () => {
  console.log(`Server listening in ${port}`);
});

