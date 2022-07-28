const blessed = require('blessed');
const contrib = require('blessed-contrib');
const axios = require('axios').default;
const fs = require('fs')

let config = fs.readFileSync('./config.json')
config = JSON.parse(config)

let subItems = {}

function urlParse(url) {
  if (typeof (url) === 'string') {
    let name = url.split('#')[1]
    url = url.split('#')[0]
    let params = url.split((/:\/\/|@|:|\?|&/g))
    if (params[0] === 'vless') {
      let vlessParams = {}
      params.slice(4).map((param) => { vlessParams[param.split('=')[0]] = param.split('=')[1] })
      return {
        name: name,
        protocol: params[0],
        id: params[1],
        address: params[2],
        port: params[3],
        params: vlessParams
      }
    }
  }
}

function getServers() {
  config.sub.map((items) => {
    axios.get(items.url).then((res) => {
      // console.log(res)
      if (res.status === 200) {
        subItems[items.name] = []
        Buffer.from(res.data, 'base64').toString().split('\n').map((url) => {
          subItems[items.name].push(urlParse(url))
        })
        serverList.clearItems()
        Object.keys(subItems).map((subName) => {
          subItems[subName].map((server) => {
            serverList.addItem(`${subName} - ${server.name}`)
            screen.render();
          })
        })
      } else {
        console.error(res.statusText)
      }
    }).catch((err) => {
      serverList.clearItems()
      serverList.addItem(`Get subscribe servers failed: check your network or subscribe url`)
      screen.render();
    })
  })
}

getServers();

const screen = blessed.screen({
  smartCSR: true,
  fullUnicode: true,
  title: 'hashigo'
})

const grid = new contrib.grid({
  rows: 20,
  cols: 20,
  screen
})

const serverList = grid.set(0, 0, 20, 20, blessed.list, {
  keys: true,
  parent: screen,
  label: 'Server List',
  selectedFg: 'black',
  selectedBg: 'white',
  align: 'left',
  border: { type: 'line' },
  style: {
    fg: 'white',
    bg: 234,
    border: {
      fg: 'cyan',
      bg: 234
    },
    label: {
      bg: 234
    }
  },
  noCellBorders: true,
  tags: true,
  wrap: false,
})

serverList.addItem(`Updating subscribe server list`)
screen.render();

serverList.key('enter', function () {
  let selected = serverList.getItem(this.selected).content.split(' - ')
  if (selected.length > 1) {
    let template = JSON.parse(fs.readFileSync(config.templateFile));
    template.outbounds.map((item) => {
      switch (item.protocol) {
        case 'vless':
          let server = subItems[selected[0]].filter(name => name.name === selected[1])[0]
          item.settings.vnext = [
            {
              port: parseInt(server.port),
              users: [
                {
                  flow: server.params.flow,
                  encryption: server.params.encryption,
                  id: server.id,
                  level: 0
                }
              ],
              address: server.address
            }
          ]
          item.streamSettings.network = server.params.type
          if (item.streamSettings.xtlsSettings)
            item.streamSettings.xtlsSettings.serverName = server.params.sni
          if (item.streamSettings.tlsSettings)
            item.streamSettings.tlsSettings.serverName = server.params.sni
          item.streamSettings.tcpSettings.header.type = server.params.headerType
          item.streamSettings.security = server.params.security
          item.protocol = server.protocol
          break;
        default:
          break;
      }
      return item;
    })
    fs.writeFileSync(config.targetFile, JSON.stringify(template, null, 2))
    process.exit(0)
  }else{
    serverList.clearItems()
    serverList.addItem(`Updating subscribe server list`)
    screen.render();
    getServers();
  }
})

screen.render();

screen.key(['escape', 'q', 'C-[', 'C-c'], () => process.exit(0));

