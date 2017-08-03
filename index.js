const Koa = require("koa");
const bodyParser = require("koa-bodyparser");
const json = require("koa-json");

const app = new Koa();

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

app.listen(8080);
