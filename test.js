/**
 * Created by Nexus on 15.08.2017.
 * modified by thmsn
 */
const BotWebInterface = require("./main");

let BWI = new BotWebInterface({ port: 2080 });

BWI.publisher.setDefaultStructure([
  { name: "botUIId", type: "text", label: "BotUI ID" },
  { name: "name", type: "text", label: "Name" },
  { name: "ticks", type: "text", label: "ticks" },
  {
    name: "health",
    type: "labelProgressBar", // this expects value to be a tuple the first value being the bar width and the second value being the text on the label
    label: "Health",
    options: { color: "red" },
  },
  {
    name: "xp",
    type: "progressBar", // this renders the value and sets the with of the bar to the value
    label: "XP",
    options: { color: "green" },
  },
  { name: "bots", type: "botUI", label: "Status" }, // botUI is a container used for "widgets" inside the "main" container
]);

let setIntervalTicks = 0;
/**
 *
 * @type {Array<BotUI>}
 */
var interfaces = [];
var subInterfaces = [];

/**
 *
 * @returns {BotUI}
 */
function create() {
  const myArray = [
    "apple",
    "banana",
    "cherry",
    "date",
    "elderberry",
    "fig",
    "grape",
  ];
  const randomElement = myArray[Math.floor(Math.random() * myArray.length)];

  const botUI = BWI.publisher.createInterface();
  botUI.setDataSource(function () {
    return {
      botUIId: botUI.id,
      name: randomElement,
      ticks: setIntervalTicks,
    };
  });

  // TODO: how would we render a monster icon?
  // TODO: what about an item icon?
  let subBotUI1 = botUI.createSubBotUI(
    [
      { name: "foo", type: "text", label: "foo" },
      { name: "id", type: "text", label: "id" },
      { name: "namse", type: "text", label: "id" },
      { name: "nsame", type: "text", label: "id" },
    ],
    "bots"
  );
  let subBotUI2 = botUI.createSubBotUI(
    [
      { name: "foo", type: "text", label: "foo" },
      { name: "id", type: "text", label: "id" },
      { name: "toggleActive", type: "button", label: "asd" },
    ],
    "bots"
  );

  return [botUI, subBotUI1, subBotUI2];
}

for (let l = 0; l < 4; l++) {
  interfaces[l] = create();
}

setInterval(function () {
  setIntervalTicks++;
  let [botUI, subBotUI1, subBotUI2] = interfaces.shift();

  // This destroy was probably for testing shutting down an interface and creating a new
  if (setIntervalTicks % 100 == 0) {
    botUI.destroy();
    interfaces.push(create());
    return;
  }

  let i = 0;
  // Update data on the interfaces. this function will be evaluated often as Publisher will call it based on the updateRate
  botUI.setDataSource(function () {
    const maxHealth = 3000;
    const health = Math.random() * maxHealth;
    const healthPercentage = (100 * health) / maxHealth;

    return {
      botUIId: botUI.id,
      ticks: setIntervalTicks,
      // notice that if you refresh (F5) the BWI, the name is no longer present, this data source has overidden the previous one
      health: [healthPercentage.toFixed(2), health.toFixed(2)],
      xp: Math.random() * 100,
    };
  });

  subBotUI1.setDataSource(function () {
    return {
      id: subBotUI1.id,
      foo: i++,
    };
  });

  subBotUI2.setDataSource(function () {
    return {
      id: subBotUI2.id,
      foo: i++,
    };
  });

  interfaces.push([botUI, subBotUI1, subBotUI2]);
}, 1000);
