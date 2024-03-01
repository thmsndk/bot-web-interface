/**
 * Created by Nexus on 30.07.2017.
 */

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
      case "text":
        if (!options)
          options = {
            value_foreground: "white",
            // TODO: handle overriding styles in a better way so we can support dark/light mode
          };
        const border = "border-b border-slate-100 dark:border-slate-700";
        // const text = "text-slate-500 dark:text-slate-400"
        html += `<div class='${name} ${border} p-4 pl-8 flex flex-row justify-between textDisplay boxRow'>
                  <div class='justify-self-start textDisplayLabel' >${label}: </div>
                  <div class='justify-self-end textDisplayValue' ></div>
                </div>`;
        break;
      case "progressBar":
        html += `<div class="${name} my-1 h-8 flex w-full h-4 bg-gray-200 overflow-hidden dark:bg-gray-700" role="progressbar" aria-valuenow="25" aria-valuemin="0" aria-valuemax="100">
                    <div class="bar p-1 flex flex-col justify-center overflow-hidden bg-blue-600 text-xs text-white text-center whitespace-nowrap dark:bg-blue-500 transition duration-500" style="width: 25%;${
                      options?.color ? `background-color:${options.color}` : ""
                    }"></div>
                    <div class="absolute p-1 value">0%</div>
                  </div>`;
        break;
      case "labelProgressBar":
        if (!options)
          options = {
            // color: "green",
            // TODO: what about light/dark mode?
          };
        // TODO: perhaps more options for different progress bar, rounded, not rounded?
        // https://preline.co/docs/progress.html

        // TODO: the label can overflow when we use position absolute, how do we handle longer values?

        html += `<div class="${name} my-1 h-8 flex w-full h-4 bg-gray-200 overflow-hidden dark:bg-gray-700" role="progressbar" aria-valuenow="25" aria-valuemin="0" aria-valuemax="100">
                    <div class="bar p-1 flex flex-col justify-center overflow-hidden bg-blue-600 text-xs text-white text-center whitespace-nowrap dark:bg-blue-500 transition duration-500" style="width: 25%;${
                      options?.color ? `background-color:${options.color}` : ""
                    }"></div>
                    <div class="absolute p-1 flex flex-row justify-between">
                      <div class="justify-self-start">${label}</div>
                      <div class="justify-self-end value">0%</div>
                    </div>
                  </div>`;
        // TODO: text left side, percent right side
        // html += `<div class='${name} progressBarDisplay boxRow'>
        //            <div class='border'>
        //             <div class='bar' style='background-color: ${options.color}'></div>
        //             <div class='barLabel'>${label}: <div class='value'>0%</div></div>
        //            </div>
        //         </div>`;
        break;
      case "image":
        if (!options) {
          options = {
            width: 200,
            height: 200,
          };
        }
        html += `<div class='${name} imageDisplay boxRow'> <img src='' style='width:${options.width}px;height:${options.height}px;'/> </div>`;
        break;
      case "graph":
        //TODO implement later
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
                  `<th class="border-b dark:border-slate-600 font-medium p-4 pl-8 pt-0 pb-3 text-slate-400 dark:text-slate-200 text-left">${x}</th>`
              )
              .join("")}
          </tr>
        </thead>`;
        }

        // <div class="max-h-[50vh] overflow-y-auto overflow-x-hidden">
        html += `
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

    if (value === undefined) continue;

    const row = this.element.getElementsByClassName(name)[0];

    switch (type) {
      case "text":
        row.getElementsByClassName("textDisplayValue")[0].innerHTML = value;
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
                `<td class="border-b border-slate-100 dark:border-slate-700 p-4 pl-8 text-slate-500 dark:text-slate-400">${rowColumnValue}</td>`
            )
            .join("");
        }

        row.replaceChild(newTbody, row.getElementsByTagName("tbody")[0]);
        break;
    }
  }
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
