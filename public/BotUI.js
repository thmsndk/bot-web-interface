/**
 * Created by Nexus on 30.07.2017.
 */
const padding = "p-1";
var BotUi = function (id, structure, parent, attachTarget) {
  this.id = id;
  this.structure = structure;
  this.parent = parent ? parent : null;
  this.children = [];
  this.attachTarget = attachTarget ? attachTarget : null;
  this.element = null;
};

BotUi.prototype.destroy = function () {
  if (this.element.parentNode)
    this.element.parentNode.removeChild(this.element);
};

BotUi.prototype.create = function () {
  var element = document.createElement("div");
  if (!this.parent) {
    element.className = "text-sm flex flex-col mx-5 min-w-80";
  } else {
    element.className = "text-sm ";
  }

  var html = "";
  for (var i in this.structure) {
    var name = this.structure[i].name;
    var label = this.structure[i].label;
    var type = this.structure[i].type;
    var options = this.structure[i].options;
    switch (type) {
      case "text": {
        if (!options)
          options = {
            value_foreground: "white",
            // TODO: handle overriding styles in a better way so we can support dark/light mode
          };
        // const border = "border-b border-slate-100 dark:border-slate-700";
        const border = ""; // no border,perhaps an option?

        html += `<div class='${name} ${border} ${padding} flex flex-row justify-between textDisplay boxRow'>
                  <div class='justify-self-start textDisplayLabel' >${label}: </div>
                  <div class='justify-self-end textDisplayValue' ></div>
                </div>`;
        break;
      }
      case "leftMiddleRightText": {
        if (!options)
          options = {
            value_foreground: "white",
            // TODO: handle overriding styles in a better way so we can support dark/light mode
          };
        // const border = "border-b border-slate-100 dark:border-slate-700";
        const border = ""; // no border,perhaps an option?

        html += `<div class='${name} ${border} ${padding} flex flex-row justify-between textDisplay boxRow'>
                    <div class='justify-self-start textValueLeft' ></div>
                    <div class='justify-self-end textValueMiddle' ></div>
                    <div class='justify-self-end textValueRight' ></div>
                  </div>`;
        break;
      }
      case "progressBar": {
        options = {
          ...{
            size: "sm",
          },
          ...options,
        };

        // TODO: perhaps more options for different progress bar, rounded, not rounded?
        // https://preline.co/docs/progress.html
        let textSize = "";
        let height = "";
        let barPadding = "px-1";
        switch (options.size) {
          case "xs":
            textSize = "text-xs";
            height = "h-4";
            break;
          case "sm":
            textSize = "text-sm";
            height = "h-6";
            barPadding = "p-1";
            break;
          case "base":
            textSize = "text-sm";
            height = "h-8";
            barPadding = "px-1 py-2";
            break;
        }
        const background = "bg-slate-200 dark:bg-slate-950";
        const text = `text-slate-700 dark:text-slate-200 ${textSize}`;
        const barBackgroundColor = options?.color
          ? `background-color:${options.color}`
          : "";

        html += `<div class="${name} my-1 flex w-full ${height} ${background} ${text} overflow-hidden" role="progressbar" aria-valuenow="25" aria-valuemin="0" aria-valuemax="100">
                    <div class="bar flex flex-col justify-center overflow-hidden bg-blue-600 text-white text-center whitespace-nowrap dark:bg-blue-500 transition duration-500" style="width: 25%;${barBackgroundColor}"></div>
                    <div class="absolute ${barPadding} value">0%</div>
                  </div>`;
        break;
      }
      case "labelProgressBar": {
        options = {
          ...{
            size: "sm",
          },
          ...options,
        };

        // TODO: perhaps more options for different progress bar, rounded, not rounded?
        // https://preline.co/docs/progress.html
        let textSize = "";
        let height = "";
        let barPadding = "px-1";
        switch (options.size) {
          case "xs":
            textSize = "text-xs";
            height = "h-4";
            break;
          case "sm":
            textSize = "text-sm";
            height = "h-6";
            barPadding = "px-1 py-1";
            break;
          case "base":
            textSize = "text-sm";
            height = "h-8";
            barPadding = "px-1 py-2";
            break;
        }

        // TODO: the label can overflow when we use position absolute, how do we handle longer values?
        const background = "bg-slate-200 dark:bg-slate-950";
        const text = `text-slate-700 dark:text-slate-200 ${textSize}`;
        const barBackgroundColor = options?.color
          ? `background-color:${options.color}`
          : "";

        // TODO: would like some margins on x axis
        html += `<div class="${name} my-1 flex w-full ${height} ${background} ${text} overflow-hidden" role="progressbar" aria-valuenow="25" aria-valuemin="0" aria-valuemax="100">
                    <div class="bar flex flex-col justify-center overflow-hidden bg-blue-600 text-white text-center whitespace-nowrap dark:bg-blue-500 transition duration-500" style="width: 25%;${barBackgroundColor}"></div>
                    <div class="absolute ${barPadding} flex flex-row justify-between">
                      <div class="justify-self-start">${label}&nbsp;</div>
                      <div class="justify-self-end value">0%</div>
                    </div>
                  </div>`;
        // TODO: text left side, percent right side
        break;
      }
      case "timerList": {
        // A container for timers, the render method is responsible for adding / removing timers
        html += `
          <div class="${name} flex flex-col">
          </div>
        `;
        break;
      }
      case "image":
        if (!options) {
          options = {
            width: 200,
            height: 200,
          };
        }
        html += `<div class='${name} imageDisplay boxRow'> <img src='' style='width:${options.width}px;height:${options.height}px;'/> </div>`;
        break;
      case "table":
        // TODO: render tables with column headers and rows
        // TODO: captions? https://tailwindcss.com/docs/caption-side
        const headers = this.structure[i].headers;
        let headersHtml = "";
        if (headers) {
          // TODO: ability to define alignment on headers
          // TODO: show date as X time ago with a tooltip of the date
          headersHtml = `<thead>
          <tr>
            ${headers
              .map(
                (x) =>
                  `<th class="border-b dark:border-slate-600 font-medium ${padding} pt-0 pb-3 text-slate-400 dark:text-slate-200 text-left">${x}</th>`
              )
              .join("")}
          </tr>
        </thead>`;
        }

        // <div class="max-h-[50vh] overflow-y-auto overflow-x-hidden">
        html += `
          <div class='${padding} text-center'>${label}</div>
          <table class="${name} border-collapse table-auto w-full text-sm">
          ${headersHtml}
          <tbody>
          </tbody>
          </table>
        `;
        // </div>
        break;
      // TODO: a left / middle / right text option
      // could display name | status | level for example
      case "button":
        if (!options) {
          options = {
            width: 200,
            height: 200,
          };
        }
        html += `<div class='${name} imageDisplay boxRow'> <img src='' style='width:${options.width}px;height:${options.height}px;'/> </div>`;
        break;
      case "botUI":
        if (!options) {
          options = {
            flexDirection: "row",
          };
        }

        const flexDirection =
          options.flexDirection == "column" ? "flex-col" : "flex-row";
        html += `<div class='${name} ${flexDirection} rounded-lg my-3 bg-slate-200 dark:bg-slate-800 shadow subBotUI'></div>`;
        break;
      case "chart":
        // html += `<div class='${name}'> <canvas id="${this.id}-${name}-chart"></canvas> </div>`;
        const background = "bg-slate-200 dark:bg-slate-800";
        const text = "text-slate-700 dark:text-slate-200";
        html += `<div class="${name} my-1 h-8 flex w-full h-4 ${background} ${text}">
                  <canvas w-full id="${this.id}-${name}-chart"></canvas> 
                </div>`;
        // TODO: How do we initialize the chart ? e.g. new Chart when it's not part of the dom yet?
        // Chart is initialized in render, as we can't use javascript to acquire the canvas element here.

        break;
    }
  }
  element.innerHTML = html;
  this.element = element;
  if (this.parent) {
    this.parent.children.push(this);
    let container = this.parent.element.getElementsByClassName(
      "subBotUI " + this.attachTarget
    )[0];
    container.appendChild(element);
  } else {
    let container = document.getElementsByClassName("botUIContainer")[0];
    container.appendChild(element);
  }
};

/**
 * Updates html object with data object
 */
BotUi.prototype.render = function () {
  if (!this.data) return;

  for (let i in this.structure) {
    const name = this.structure[i].name;
    const type = this.structure[i].type;
    const value = this.data[name];
    let options = this.structure[i].options;

    if (value === undefined) continue;

    // TODO: is there an issue with the name? e.g. we have two "timers" and it's not properly found in the subUI?

    const row = this.element.getElementsByClassName(name)[0];

    switch (type) {
      case "text":
        row.getElementsByClassName("textDisplayValue")[0].innerHTML = value;
        break;
      case "leftMiddleRightText":
        const { left, middle, right } = value;
        row.getElementsByClassName("textValueLeft")[0].innerHTML = left;
        row.getElementsByClassName("textValueMiddle")[0].innerHTML = middle;
        row.getElementsByClassName("textValueRight")[0].innerHTML = right;
        break;

      case "progressBar":
        row.getElementsByClassName("bar")[0].style.width = value + "%";
        row.getElementsByClassName("value")[0].innerHTML = value + "%";
        break;
      case "labelProgressBar":
        row.getElementsByClassName("bar")[0].style.width = value[0] + "%";
        row.getElementsByClassName("value")[0].innerHTML = value[1];
        break;
      case "image":
        row.getElementsByTagName("img")[0].src = value;
        break;
      case "graph":
        //TODO implement later
        break;
      case "botUI":
        break;
      case "table":
        const newTbody = document.createElement("tbody");
        for (let index = 0; index < value.length; index++) {
          const element = value[index];
          const newRow = newTbody.insertRow(index);
          newRow.innerHTML = element
            .map(
              (rowColumnValue) =>
                `<td class="border-b border-slate-100 dark:border-slate-700 ${padding} text-slate-500 dark:text-slate-400">${rowColumnValue}</td>`
            )
            .join("");
        }

        row.replaceChild(newTbody, row.getElementsByTagName("tbody")[0]);
        break;
      case "timerList": {
        for (let index = 0; index < value.length; index++) {
          const { leftText, middleText, rightText, percentage } = value[index];

          // Add timer to markup if we don't have one at the appropriate index
          let timerElement = row.querySelector(`#${name}${index}`);
          if (!timerElement) {
            const options = {};
            this.addTimerElement(row, name, options, index);
            continue;
          }

          // Make timer visible
          timerElement.style.display = "";

          // Update values of timer
          timerElement.getElementsByClassName("bar")[0].style.width =
            percentage + "%";

          timerElement.getElementsByClassName("textValueLeft")[0].innerHTML =
            leftText ?? "";
          timerElement.getElementsByClassName("textValueMiddle")[0].innerHTML =
            middleText ?? "";
          timerElement.getElementsByClassName("textValueRight")[0].innerHTML =
            rightText ?? "";
        }

        // Hide extra timers
        const timersToHide =
          value.length > 0 ? Array.from(row.children).slice(value.length) : [];

        for (const timerElement of timersToHide) {
          // Hide timer
          timerElement.style.display = "none";
        }

        break;
      }

      case "chart":
        const defaults = {
          type: "line",
          scales: {
            x: {
              display: false,
            },
            y: {
              display: false,
            },
          },
        };

        options = { ...defaults, ...options };
        // TODO: handle pie charts https://www.chartjs.org/docs/latest/charts/doughnut.html

        const data = value.data;

        const canvas = document.getElementById(`${this.id}-${name}-chart`);
        if (!canvas.dataset.chartInitialized) {
          console.log(`initializing chart! ${this.id}-${name}-chart`);
          canvas.dataset.chartInitialized = true;

          // const barChart =
          new Chart(canvas, {
            type: options.type,
            options: {
              responsive: true,
              maintainAspectRatio: false,
              animation: false,
              scales: options.scales,
              plugins: {
                legend: {
                  display: false,
                },
                tooltip: {
                  enabled: false,
                },
                labels: {
                  enabled: false,
                },
              },
            },
            data: {
              labels: data.map((row) => row.year), // not showing x-axis labels
              datasets: [
                {
                  // label: "Acquisitions by year",
                  data: data.map((row) => row.count),
                },
              ],
            },
          });
        } else {
          const chart = Chart.getChart(canvas);
          chart.data.labels = data.map((row) => row.label);
          chart.data.datasets = [
            { data: data.map((row) => Math.floor(row.value)) },
          ];

          chart.update();
        }
        break;
    }
  }
};

BotUi.prototype.addTimerElement = function (row, name, options, index) {
  if (!options) {
    options = {};
  }

  const background = "bg-slate-200 dark:bg-slate-800";
  const text = "text-slate-700 dark:text-slate-200";
  html = `<div id="${name}${index}" class="${name} relative my-1 h-6 flex w-full ${background} ${text} overflow-hidden" role="progressbar" aria-valuenow="25" aria-valuemin="0" aria-valuemax="100">
                <div class="bar p-1 flex flex-col justify-center overflow-hidden bg-blue-600 text-white text-center whitespace-nowrap dark:bg-blue-500 transition duration-500" style="width: 25%;${
                  options?.color ? `background-color:${options.color}` : ""
                }"></div>
                <div class="absolute w-full flex justify-items-stretch text-sm">
                  <div class='w-full p-1 justify-self-start text-left textValueLeft' ></div>
                </div>
                <div class="absolute w-full flex justify-items-stretch text-sm">
                  <div class='w-full p-1 justify-self-center text-center textValueMiddle' ></div>
                </div>
                <div class="absolute w-full flex justify-items-stretch text-sm">
                  <div class='w-full p-1 justify-self-end text-right textValueRight' ></div>
                </div>
              </div>`;

  const temp = document.createElement("div");
  temp.innerHTML = html;
  row.appendChild(temp.firstChild);
};

/**
 * Updates bot data
 */
BotUi.prototype.update = function (data) {
  this.data = data;
  this.render();
};

BotUi.prototype.updateProperty = function (name, value) {
  this.data[name] = value;
  this.render();
};

// https://stackoverflow.com/a/74456486
function timeAgo(date) {
  var seconds = Math.floor(
    (new Date().getTime() - new Date(date).getTime()) / 1000
  );
  var interval = seconds / 31536000;
  if (interval > 1) return Math.floor(interval) + " years";
  interval = seconds / 2592000;
  if (interval > 1) return Math.floor(interval) + " months";
  interval = seconds / 86400;
  if (interval > 1) return Math.floor(interval) + " days";
  interval = seconds / 3600;
  if (interval > 1) return Math.floor(interval) + " hours";
  interval = seconds / 60;
  if (interval > 1) return Math.floor(interval) + " minutes";
  return Math.floor(seconds) + " seconds";
}
