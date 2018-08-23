/* eslint no-underscore-dangle: ["error", { "allow": ["_context"] }] */
/* eslint no-param-reassign: ["error", { "props": false }] */

const Commands = require('./commands');
const Events = require('./events');
const datastore = require('../datastore');
const evaluator = require('./evaluator');
const pkg = require('../../package.json');
const writer = require('./writer');

const chalk = require('chalk');
const chokidar = require('chokidar');
const repl = require('repl');
const R = require('ramda');
const { VM } = require('vm2');

const REPL_PROMPT = 'pwdb> ';
const VM_DEFAULT_TIMEOUT = 3;

const displayIntro = (filename) => {
  const datastoreName = R.defaultTo('in-memory only', filename);
  const openHint = filename ? '' :
    `Use ${chalk.underline('.open FILENAME')} to reopen on a persistent datastore.`;
  const intro = `
    pwdb v${pkg.dependencies.pwdb} - REPL v${pkg.version}
    Enter ${chalk.underline('.help')} for usage hints.
    Connected to ${chalk.bold(datastoreName)} datastore.
    ${openHint}
  `.replace(/(\n\s+|\n\n)/g, '\n');

  console.log(intro);
};

exports.setDatastore = (context, filename) => {
  if (context.watcher) context.watcher.close();
  return datastore(filename).then((ds) => {
    Object.defineProperty(context.vm._context, 'db', {
      configurable: true,
      enumarable: true,
      value: ds,
    });

    context.watcher = chokidar
      .watch(filename)
      .on('change', () => this.setDatastore(context, filename));
  });
};

exports.setVM = (context, filename, options = {}) => {
  context.vm = new VM({
    timeout: R.defaultTo(VM_DEFAULT_TIMEOUT, options.timeout) * 1000,
  });

  return this.setDatastore(context, filename);
};

module.exports = (filename, options = {}) => {
  displayIntro(filename);
  const pwdbRepl = repl.start({
    writer,
    eval: evaluator,
    prompt: REPL_PROMPT,
  });

  R.mapObjIndexed((cmd, keyword) => {
    pwdbRepl.defineCommand(keyword, cmd);
  }, Commands);

  pwdbRepl.options = options;
  pwdbRepl.options.filename = filename;

  pwdbRepl.on('reset', Events.reset);
  pwdbRepl.on('exit', Events.exit);

  return this.setVM(pwdbRepl.context, filename, options).then(() => pwdbRepl);
};
