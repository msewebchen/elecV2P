const fs = require('fs')
const path = require('path')
const axios = require('axios')

const { CONFIG, CONFIG_Port } = require('../config')

const { sJson, errStack } = require('./string')

const { list, file } = require('./file')
const uagent = sJson(list.get('useragent.list')) || {}

const { logger } = require('./logger')
const clog = new logger({ head: 'eAxios' })

const CONFIG_Axios = {
  proxy:   false,           // axios 请求代理
  timeout: 5000,            // axios 请求超时时间。单位：毫秒
  uagent:  'iPhone'         // 通用 User-Agent，相关列表为 script/Lists/useragent.list
}

if (CONFIG.CONFIG_Axios) {
  Object.assign(CONFIG_Axios, CONFIG.CONFIG_Axios)
} else {
  CONFIG.CONFIG_Axios = CONFIG_Axios
}

/**
 * axios 简易封装
 * @param     {object/string}    request      axios 请求内容
 * @param     {[object json]}    proxy        代理，会覆盖 config 设置
 * @return    {promise}                 axios promise
 */
function eAxios(request, proxy) {
  const getUagent = ()=>uagent[CONFIG_Axios.uagent] ? uagent[CONFIG_Axios.uagent].header : null

  if (typeof(request) === 'string') {
    request = {
      url: request
    }
  }
  if (request.data === undefined) request.data = request.body
  if (request.timeout === undefined) request.timeout = CONFIG_Axios.timeout
  if (request.headers === undefined) {
    request.headers = {
      "User-Agent": getUagent()
    }
  } else if (request.headers['User-Agent'] === undefined) {
    request.headers['User-Agent'] = getUagent()
  }

  if (proxy !== false && (proxy || CONFIG_Axios.proxy)) {
    request.proxy = proxy || CONFIG_Axios.proxy
    if (request.proxy.port === undefined) {
      request.proxy.port = CONFIG_Port.proxy
    }
  }

  return new Promise((resolve, reject)=>{
    axios(request).then(res=>resolve(res)).catch(e=>reject(e))
  })
}

function downloadfile(durl, dest) {
  if (!durl.startsWith('http')) return Promise.reject(durl + ' is not a valid url')
  let folder = '', fname = '', isFolder = false
  if (dest) {
    dest = path.normalize(dest)
    isFolder = file.isExist(dest, true)
  } 
  if (!dest || isFolder) {
    const sdurl = durl.split(/\/|\?|#/)
    do {
      fname = sdurl.pop().trim()
    } while (fname === '')
  }
  if (isFolder) {
    folder = dest
  } else if (dest && dest.indexOf(path.sep) !== -1) {
    folder = dest.slice(0, dest.lastIndexOf(path.sep))
    if (!fs.existsSync(folder)) fs.mkdirSync(folder, {recursive: true})
    fname = dest.slice(dest.lastIndexOf(path.sep))
  } else {
    folder = file.get(CONFIG.efss.directory || 'web/dist', 'path')
  }
  
  dest = path.join(folder, fname || dest)
  return new Promise((resolve, reject)=>{
    eAxios({
      url: durl,
      responseType: 'stream'
    }).then(response=>{
      if (response.status == 404) {
        clog.error(durl + ' 404! file dont exist')
        reject('404! file dont exist')
        return
      }
      let file = fs.createWriteStream(dest)
      response.data.pipe(file)
      file.on('finish', ()=>{
        clog.notify("download: " + durl + " to: " + dest)
        file.close()
        resolve(dest)
      })
    }).catch(e=>{
      reject('download fail! ' + e.message)
      clog.error(durl, 'download fail!', errStack(e))
    })
  })
}

module.exports = { CONFIG_Axios, eAxios, downloadfile }