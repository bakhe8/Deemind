/* eslint-env browser */

import { Bridge } from './bridge.js';

function renderIndex(data) {
  const health = document.querySelector('#summary-health');
  const scripts = document.querySelector('#summary-scripts');
  const tools = document.querySelector('#summary-tools');
  if (health) health.textContent = `${data?.features?.[0] || '—'}`;
  if (scripts) scripts.textContent = `${data?.scripts?.length || 0} scripts`;
  if (tools) tools.textContent = `${data?.tools?.length || 0} tools`;
  const featureList = document.querySelector('#feature-list');
  if (featureList && Array.isArray(data?.features)) {
    featureList.innerHTML = '';
    data.features.forEach((feature) => {
      const item = document.createElement('li');
      item.textContent = feature;
      featureList.appendChild(item);
    });
  }
}

function renderCommands(data) {
  const scriptList = document.querySelector('#script-list');
  const toolList = document.querySelector('#tool-list');
  const configList = document.querySelector('#config-list');
  if (scriptList && Array.isArray(data?.scripts)) {
    scriptList.innerHTML = '';
    data.scripts.forEach((script) => {
      const card = document.createElement('div');
      card.className = 'code-card';
      card.innerHTML = `<div class="text-slate-400 text-xs uppercase mb-1">${script.name}</div><div>${script.command}</div>`;
      scriptList.appendChild(card);
    });
  }
  if (toolList && Array.isArray(data?.tools)) {
    toolList.innerHTML = '';
    data.tools.forEach((tool) => {
      const li = document.createElement('li');
      li.innerHTML = `<span>${tool.name}</span><a href="${tool.path}" target="_blank" class="badge">Open</a>`;
      toolList.appendChild(li);
    });
  }
  if (configList && Array.isArray(data?.configs)) {
    configList.innerHTML = '';
    data.configs.forEach((config) => {
      const li = document.createElement('li');
      li.innerHTML = `<span>${config.name}</span><a href="${config.path}" target="_blank" class="badge">View</a>`;
      configList.appendChild(li);
    });
  }
}

function renderCustomization(data) {
  const table = document.querySelector('#requests-table tbody');
  if (!table) return;
  table.innerHTML = '';
  if (!Array.isArray(data?.customRequests) || !data.customRequests.length) {
    const row = document.createElement('tr');
    row.innerHTML = `<td colspan="4" class="text-slate-400 text-center py-4">No customization requests logged.</td>`;
    table.appendChild(row);
    return;
  }
  data.customRequests.forEach((req) => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${req.title}</td>
      <td>${req.target || '—'}</td>
      <td><span class="badge ${req.status === 'done' ? 'badge-success' : req.status === 'in-progress' ? 'badge-warning' : ''}">${req.status}</span></td>
      <td>${req.updated || '—'}</td>
    `;
    table.appendChild(row);
  });
}

function renderStatus(data) {
  const schemaList = document.querySelector('#schema-list');
  const settingsList = document.querySelector('#settings-list');
  if (schemaList) {
    schemaList.innerHTML = '';
    (data?.schemaFields || []).forEach((field) => {
      const li = document.createElement('li');
      li.textContent = field;
      schemaList.appendChild(li);
    });
  }
  if (settingsList) {
    settingsList.innerHTML = '';
    (data?.settingsKeys || []).forEach((key) => {
      const li = document.createElement('li');
      li.innerHTML = `<span>${key}</span>`;
      settingsList.appendChild(li);
    });
  }
}

function renderLogs(data) {
  const logArea = document.querySelector('#system-log');
  const taskList = document.querySelector('#tasks-list');
  if (logArea) {
    logArea.textContent = data?.systemLog || 'No logs recorded.';
  }
  if (taskList) {
    taskList.innerHTML = '';
    (data?.taskLog || []).forEach((task) => {
      const li = document.createElement('li');
      li.innerHTML = `<span>${task.task}</span><span class="badge">${task.status}</span>`;
      taskList.appendChild(li);
    });
  }
}

const renderMap = {
  index: renderIndex,
  commands: renderCommands,
  customization: renderCustomization,
  status: renderStatus,
  logs: renderLogs,
};

document.addEventListener('DOMContentLoaded', () => {
  const page = document.body.dataset.page || 'index';
  Bridge.subscribe((data) => {
    const renderer = renderMap[page];
    if (renderer) renderer(data);
  });
});
