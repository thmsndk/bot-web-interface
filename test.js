/**
 * Created by Nexus on 15.08.2017.
 * modified by thmsn
 */
const BotWebInterface = require("./main");

let BWI = new BotWebInterface({ updateRate: 500, port: 2080 });

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
  // botUI is a container used for "widgets" inside the "main" container
  // TODO: define columns mode or rows mode where each subwidget is ordered depending on this
  { name: "bots", type: "botUI", label: "Status" },
  {
    name: "bots2",
    type: "botUI",
    label: "Status",
    options: { flexDirection: "column" },
  },
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
  // TODO: show (de)buffs? monsterhunt
  // TODO: gradient colored progressbar?
  // TODO: potions available?
  // TODO: Show tracktrix? computer image?
  let subBotUI1 = botUI.createSubBotUI(
    [
      { name: "foo", type: "text", label: "foo sub1" },
      { name: "id", type: "text", label: "id" },
      { name: "namse", type: "text", label: "namse" },
      { name: "nsame", type: "text", label: "nsame" },
    ],
    "bots"
  );
  let subBotUI2 = botUI.createSubBotUI(
    [
      { name: "foo", type: "text", label: "foo sub2" },
      { name: "id", type: "text", label: "id" },
      { name: "toggleActive", type: "button", label: "asd" },
    ],
    "bots"
  );

  let subBotUI3 = botUI.createSubBotUI(
    [
      { name: "foo", type: "text", label: "foo sub3" },
      { name: "id", type: "text", label: "id" },
      { name: "namse", type: "text", label: "namse" },
      { name: "nsame", type: "text", label: "nsame" },
    ],
    "bots2"
  );
  let subBotUI4 = botUI.createSubBotUI(
    [
      { name: "foo", type: "text", label: "foo sub4" },
      { name: "id", type: "text", label: "id" },
      { name: "toggleActive", type: "button", label: "asd" },
    ],
    "bots2"
  );

  return [botUI, subBotUI1, subBotUI2, subBotUI3, subBotUI4];
}

for (let l = 0; l < 4; l++) {
  interfaces[l] = create();
}

setInterval(function () {
  setIntervalTicks++;
  let [botUI, subBotUI1, subBotUI2, subBotUI3, subBotUI4] = interfaces.shift();

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
      health: [
        healthPercentage.toFixed(2),
        `${health.toFixed(2)} / ${maxHealth}`,
      ],
      xp: (Math.random() * 100).toFixed(2),
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

  subBotUI3.setDataSource(function () {
    return {
      id: subBotUI3.id,
      foo: i++,
    };
  });

  subBotUI4.setDataSource(function () {
    return {
      id: subBotUI4.id,
      foo: i++,
    };
  });

  interfaces.push([botUI, subBotUI1, subBotUI2, subBotUI3, subBotUI4]);
}, 1000);
