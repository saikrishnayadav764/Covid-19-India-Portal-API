const express = require("express");
const app = express();
const path = require("path");
let { open } = require("sqlite");
let sqlite3 = require("sqlite3");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const dbPath = path.join(__dirname, "covid19IndiaPortal.db");
let db = null;

const server = async () => {
  db = await open({
    filename: dbPath,
    driver: sqlite3.Database,
  });
};

server();

app.use(express.json());

function converter(obj) {
  return {
    stateId: obj.state_id,
    stateName: obj.state_name,
    population: obj.population,
  };
}

function converter_two(obj) {
  return {
    districtId: obj.district_id,
    districtName: obj.district_name,
    stateId: obj.state_id,
    cases: obj.cases,
    cured: obj.cured,
    active: obj.active,
    deaths: obj.deaths,
  };
}

app.post("/login/", async (req, res) => {
  const { username, password } = req.body;
  let query = `SELECT * FROM user WHERE username = '${username}'`;
  let result = await db.get(query);
  if (result === undefined) {
    res.status(400);
    res.send("Invalid user");
  } else {
    const isMatched = await bcrypt.compare(password, result.password);
    if (isMatched) {
      const payload = {
        username: username,
      };
      const jwtToken = jwt.sign(payload, "SECRET");
      res.send({ jwtToken: jwtToken });
    } else {
      res.status(400);
      res.send("Invalid password");
    }
  }
});

const authenticate = (req, res, next) => {
  let jwtToken;
  let authHeader = req.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken === undefined) {
    res.status(401);
    res.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "SECRET", (error, payload) => {
      if (error) {
        res.status(401);
        res.send("Invalid JWT Token");
      } else {
        req.username = payload.username;
        next();
      }
    });
  }
};

app.get("/states/", authenticate, async (request, response) => {
  let query = "SELECT * FROM state";
  let result = await db.all(query);
  let fin = result.map((ele) => {
    return converter(ele);
  });
  response.send(fin);
});

app.get("/states/:stateId", authenticate, async (request, response) => {
  const { stateId } = request.params;
  let query = `SELECT * FROM state WHERE state_id = ${stateId}`;
  let result = await db.get(query);
  response.send(converter(result));
});

app.post("/districts", authenticate, async (request, response) => {
  const details = request.body;
  const { districtName, stateId, cases, cured, active, deaths } = details;
  let query = `INSERT INTO district(district_name,state_id,cases,cured,active,deaths) 
  VALUES('${districtName}', ${stateId}, ${cases}, ${cured}, ${active}, ${deaths})`;
  await db.run(query);
  response.send("District Successfully Added");
});

app.get("/districts/:districtId", authenticate, async (request, response) => {
  const { districtId } = request.params;
  let query = `SELECT * FROM district WHERE district_id = ${districtId}`;
  let result = await db.get(query);
  response.send(converter_two(result));
});

app.delete(
  "/districts/:districtId",
  authenticate,
  async (request, response) => {
    const { districtId } = request.params;
    let query = `DELETE FROM district WHERE district_id = ${districtId}`;
    await db.run(query);
    response.send("District Removed");
  }
);

app.put("/districts/:districtId", authenticate, async (request, response) => {
  const { districtId } = request.params;
  const details = request.body;
  const { districtName, stateId, cases, cured, active, deaths } = details;
  let query = `UPDATE district SET district_name = "${districtName}",state_id = ${stateId},cases = ${cases},cured = ${cured},active = ${active},deaths = ${deaths} 
  WHERE district_id = ${districtId}`;
  await db.run(query);
  response.send("District Details Updated");
});

app.get("/states/:stateId/stats/", authenticate, async (request, response) => {
  const { stateId } = request.params;
  let query = `SELECT SUM(cases) AS totalCases, SUM(cured) AS totalCured,SUM(active) AS totalActive,SUM(deaths) AS totalDeaths FROM district WHERE state_id = ${stateId}`;
  let result = await db.get(query);
  response.send(result);
});

app.get(
  "/districts/:districtId/details/",
  authenticate,
  async (request, response) => {
    const { districtId } = request.params;
    let query = `SELECT state_name FROM state INNER JOIN district ON state.state_id = district.state_id WHERE district_id = ${districtId}`;
    let result = await db.get(query);
    response.send({ stateName: result.state_name });
  }
);

app.listen(3000);
module.exports = app;
