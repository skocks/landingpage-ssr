import fs from "fs";
import { program } from 'commander';
import express from "express";
import { Liquid } from "liquidjs";
import livereload from "livereload";
import connectLivereload from "connect-livereload";
import chokidar from "chokidar";
import sass from "node-sass";

interface Params {
  shop: string;
  port: number;
}

const { shop, port } = parseParameters();
const cwd = process.cwd();

watchCss();
initLivereLoad();
initDevserver();

function parseParameters(): Params {
  program
    .version('1.0.0')
    .requiredOption('-s, --shop <shop>', 'apollo shop number')
    .option('-p, --port <port>', 'port number', '3000')
    .parse(process.argv);

  return program.opts() as Params;
}

function watchCss() {
  chokidar.watch(`${cwd}/${shop}/scss`, {
    ignoreInitial: true,
    awaitWriteFinish: {
      stabilityThreshold: 500,
      pollInterval: 100
    },
  }).on('all', () => {
    renderCss();
  });
  renderCss();
}

function renderCss() {
  sass.render({
    file: `${cwd}/${shop}/scss/bootstrap.scss`,
    outFile: `${cwd}/${shop}/css/bootstrap.css`,
    sourceMap: true,
    sourceMapEmbed: false,
    outputStyle: 'compressed',
  }, function (error, result) {
    if (error) {
      if (error.status) {
        console.log(error.status);
      }
      if (error.line) {
        console.log('line:', error.line);
      }
      if (error.column) {
        console.log('column:', error.column);
      }
      if (error.message) {
        console.log(error.message);
      }
    } else {
      fs.writeFile(`${cwd}/${shop}/css/bootstrap.css`, result.css, function (err) {
        if (err) {
          console.log(err);
          return;
        }
      });
      fs.writeFile(`${cwd}/${shop}/css/bootstrap.css.map`, result.map, function (err) {
        if (err) {
          console.log(err);
          return;
        }
      });
    }
  });
}

function initLivereLoad() {
  const liveReloadServer = livereload.createServer({ port: 3001, extraExts: ['liquid'] });
  liveReloadServer.watch([`${cwd}/${shop}/css`, `${cwd}/${shop}/*.liquid`]);
}

function initDevserver() {
  const app = express();
  app.use(connectLivereload({ port: 3001 }));

  const engine = new Liquid();
  app.engine("liquid", engine.express());
  app.set("views", `${cwd}/${shop}`);
  app.set("view engine", "liquid");

  app.get("/:directory/:file", (req, res) => {
    const { directory, file } = req.params;
    res.sendFile(`${shop}/${directory}/${file}`, { root: process.cwd() });
  });

  app.get("/:template", async (req, res) => {
    const { template } = req.params;
    if (template.endsWith('.liquid')) {
      const result = await fetch('https://random-data-api.com/api/v2/users');
      const user = await result.json();

      res.render(template, { user, devserver: true });
    } else {
      res.sendFile(`${shop}/${template}`, { root: process.cwd() });
    }
  });

  app.listen(port, async () => {
    printTemplates();
  });
}

function printTemplates() {
  fs.readdir(`${cwd}/${shop}`, function (err, files) {
    if (err) {
      return console.log('Unable to scan directory: ' + err);
    }
    files.forEach(function (file) {
      if (file.endsWith('.liquid') || file.endsWith('.html')) {
        console.log(`http://localhost:${port}/${file}`);
      }
    });
  });
}