const Koa = require("koa");
const bodyParser = require("koa-bodyparser");
const json = require("koa-json");
const mount = require("koa-mount");
const basicAuth = require("koa-basic-auth");

const app = new Koa();

const auth = basicAuth(require("./.auth"));

app.use(mount("/server", auth));
app.use(mount("/project", auth));

app.use(bodyParser());

app.use(json({
	pretty: true
}));

app.use(require("./routes/server/create"));
app.use(require("./routes/server/find"));
app.use(require("./routes/server/edit"));
app.use(require("./routes/server/list"));
app.use(require("./routes/server/delete"));

app.use(require("./routes/project/create"));
app.use(require("./routes/project/find"));
app.use(require("./routes/project/edit"));
app.use(require("./routes/project/list"));
app.use(require("./routes/project/delete"));
app.use(require("./routes/project/deploy"));

app.use(require("./routes/log/top.js"));
app.use(require("./routes/log/find.js"));

app.use(require("./routes/push"));

app.listen(8080, "127.0.0.1");
