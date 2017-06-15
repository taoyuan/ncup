/**
 * Created by taoyuan on 2017/6/14.
 */

const _ = require("lodash");
const clc = require("cli-color");
const inquirer = require('inquirer');
const Manager = require('../manager');
const utils = require('./utils');
const windowText = utils.initCliWindowWithText;

module.exports = async function install() {
  await new Installer().start();
};


/**
 *
 * The installer class handles the CLI input and output for the installation process
 *
 * workflow:
 *
 * 1.) start
 *          -> find printers
 * 2.) builds printer choices for prompt
 *
 * 3.) PROMPT: select a printer
 *          [or search again -> 1.]
 *
 * 4.) find drivers by printer or search slug
 *
 * 5.) PROMPT: select a driver
 *          [or cancel and go to printers -> 2.]
 *          [or search with own slug -> 4.]
 *
 * 6.) PROMPT: set additional configurations
 *
 * 7.) PROMPT: install [or quit]
 *
 */

class Installer {

  /**
   * installer class constructor
   */
  constructor() {
    this.pm = new Manager();
    this.selectedPrinter = null;
    this.selectedDriver = null;

    this.foundPrinters = [];
    this.foundDrivers = [];

    this.spinner = utils.spinner();
  }

  /**
   * start the installation process for the CLI
   */
  async start() {
    await this.findPrinters();
  }

  /**
   * find printers within the local network or directly attached to the machine
   * and build a inquirer choices object and call the printer selection prompt
   */
  async findPrinters() {

    // clear the current shell window and print app message
    windowText(" ncup ");

    // check, if printers had already been searched
    if (this.foundPrinters.length > 0) {
      // if so, go on with printer selection
      return this.promptPrinterSelection(this.foundPrinters);
    }

    // start the spinner for indicating searching process
    this.spinner.start();

    // run search printers and catch callback
    const searchPrintersResult = await this.pm.discover();

    // printer counter
    let count = 0;

    // stop the spinner, because we are already in the callback
    this.spinner.stop();

    // clean the window again
    windowText(" ncup ");

    // distinguish between USB and NETWORK printers
    let network = searchPrintersResult['network'] || [];
    let usb = searchPrintersResult['direct'] || [];

    // set the found printers array to an empty array (in case something was found before)
    this.foundPrinters = [];

    // push a line separator to the found printers array (to distinguish in menu)
    this.foundPrinters.push(new inquirer.Separator(clc.green.bold("------  MENU  ------------------")));

    // add a menu option to search again
    this.foundPrinters.push({
      name: (("Search again")),
      value: "again"
    });

    // add a menu option to quit
    this.foundPrinters.push({
      name: (("quit")),
      value: "cancel"
    });

    if (usb.length > 0) {
      // push a line separator to the found printers array (to distinguish in menu)
      this.foundPrinters.push(new inquirer.Separator(clc.blue.bold("------  USB PRINTERS  -------")));
      // loop over the direct available printers
      _.forEach(usb, (item) => {

        count++; //increas printers counter
        this.foundPrinters.push({
          name: item._description + " (" + clc.red.italic("USB") + ")",
          value: item
        });
      })
    }

    if (network.length > 0) {
      // push a line separator to the found printers array (to distinguish in menu)
      this.foundPrinters.push(new inquirer.Separator(clc.blue.bold("------  NETWORK PRINTERS  ------")));

      // loop over the network available printers
      _.forEach(network, (item) => {
        count++; //increas printers counter
        this.foundPrinters.push({
          name: item._description + " (" + clc.red.italic("NETWORK") + ")",
          value: item
        });
      })
    }

    //promptShouldSearchDriversAgain();
    console.log("\n" + clc.green.bold(`! Found ${count} printer(s).`));

    this.promptPrinterSelection(this.foundPrinters);
  }

  /**
   *
   * @param arrDrivers
   */
  prepareSelectPrinterDriverPromptChoices(arrDrivers) {

    // create a reference to the class for the promise
    let self = this;

    // printer counter
    let count = 0;

    // reset and|or initialize this value
    this.foundDrivers = [];


    // push a line separator to the found printers array (to distinguish in menu)
    this.foundDrivers.push(new inquirer.Separator(clc.green.bold("------  MENU  ------------------")));

    // add a menu option to search with slug
    this.foundDrivers.push({
      name: "Search other driver by custom slug",
      value: "other"
    });

    // add a menu option to cancel
    this.foundDrivers.push({
      name: "Cancel",
      value: "cancel"
    });

    // push a line separator to the found printers array (to distinguish in menu)
    this.foundDrivers.push(new inquirer.Separator(clc.blue.bold("-------  DRIVERS SELECTION  -------")));
    _.forEach(arrDrivers, (driver) => {
      count++;
      this.foundDrivers.push({
        name: driver.makeAndModel + " (" + clc.red(driver.id) + ")",
        value: driver
      })
    });

    console.log("\n" + clc.green.bold(`! Found ${count} driver(s).`));
    inquirer
      .prompt({
        type: 'list',
        name: 'selectedDriver',
        message: 'Please select the driver you want to use?',
        choices: this.foundDrivers,
        default: 2
      })
      .then((resultFoundDrivers) => {
        switch (resultFoundDrivers.selectedDriver) {
          case "other":
            return self.promptEnterSearchDriverWithSlug();
            break;
          case "cancel":
            return self.findPrinters();

            break;
          default:

        }

        self.selectedDriver = resultFoundDrivers.selectedDriver;

        return self.definePrinterQueueSettings();
      });

    //console.log(arrDrivers);

  }

  /**
   * prompts a printer selection based on the choices object
   * @param choices
   */
  async promptPrinterSelection(choices) {
    await inquirer
    // define the promt message
      .prompt({
        type: 'list',
        name: 'printer',
        message: 'Which one do you want to install?',
        choices: choices,
        default: 2
      })
      // handle the promts result
      .then(async (answer) => {
        if (answer.printer === "again") {

          // reset the found printers array, so it can search again
          this.foundPrinters = [];
          return await this.findPrinters();
        }
        if (answer.printer === "cancel") {
          console.log("! quit");
          process.exit(0);
        }

        this.selectedPrinter = answer.printer;

        await this.searchDriverWithSlug(answer.printer._model);
      });
  }

  /**
   * search the printer driver database of CUPS by a given slug
   * @param slug
   */
  async searchDriverWithSlug(slug) {
    try {
      // call the find function
      const arrFoundDrivers = await this.pm.findDrivers(slug);

      // in case of nothing found, ask if should search again
      if (arrFoundDrivers.length === 0) {
        return this.promptShouldSearchDriversAgain();
      }

      this.prepareSelectPrinterDriverPromptChoices(arrFoundDrivers);
    } catch (e) {
      // in case of an error, ask if should search again
      return this.promptShouldSearchDriversAgain();
    }
  }

  /**
   *
   * @param slug
   */
  promptEnterSearchDriverWithSlug(slug) {

    inquirer
      .prompt({
        type: 'input',
        name: 'slug',
        message: 'Search driver by slug. Please enter a slug:',

      })
      .then(answer => {
        return this.searchDriverWithSlug(answer['slug']);
      });

  }

  /**
   *
   */
  promptShouldSearchDriversAgain() {

    let self = this;

    inquirer
      .prompt({
        type: 'list',
        name: 'again',
        message: 'No driver found. Would you like to search by entering a search slug?',
        choices: ["yes", "no"]
      })
      .then(answer => {
        switch (answer.again) {
          case "yes":
            return self.promptEnterSearchDriverWithSlug();
            break;
          case "no":
          default:
            return self.findPrinters();

        }
      });
  }

  /**
   * additionally settings you may define
   * @param opts
   */
  async definePrinterQueueSettings(opts) {
    const questions = [
      {
        type: "input",
        name: "queue",
        message: "Please define the PRINT QUEUE name:",
        validate: input => {

          if (input.match(/\s/)) {

            return "Whitespaces are not allowed in a printer queue";
          }

          if (input.match(/[^a-zA-Z\-\_0-9]/gmi)) {
            return 'Only "letters", "numbers", "_" and "-" is allowed';
          }

          return true;


        },
        default: this.selectedPrinter._name
      },
      {
        type: "input",
        name: "description",
        message: "Please define the printer description / title:",
        default: this.selectedPrinter._description
      },
      {
        type: "input",
        name: "location",
        message: "Please define the printer location",
        default: this.selectedPrinter._location
      },
      {
        type: "confirm",
        name: "shared",
        message: "Do you want to share this printer on your network",
        default: false
      }
    ];

    const answers = await inquirer.prompt(questions);
    this.selectedPrinter._name = answers['queue'];
    this.selectedPrinter._description = answers['description'];
    this.selectedPrinter._location = answers['location'];
    this.selectedPrinter.isShared = answers['shared'];
    //this.selectedPrinter._questionCallback = answers['queue'];

    //console.log("! You have selected the printer: " + clc.blue.bold(this.selectedPrinter._description));
    //console.log("! You have selected the driver:  " + clc.blue.bold(this.selectedDriver['make-and-model']));
    const answer = await inquirer.prompt({
      name: "doInstall",
      type: "confirm",
      message: "Do you want to install this printer?"
    });

    //console.log("result", result);
    if (answer['doInstall'] === true) {
      this.selectedPrinter.setDriver(this.selectedDriver.driver);
      await this.selectedPrinter.install();
      console.log(clc.green.bold("! Printer successfully installed."));
    }
    return await this.findPrinters();
  }

}
