import yts from 'yt-search'
import fetch from 'node-fetch'
import { getBuffer } from '../../core/message.js'
import fs from 'fs'
import { exec } from 'child_process'

const isYTUrl = (url) => /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+$/i.test(url)

async function getVideoInfo(query, videoMatch) {
  const search = await yts(query)
  if (!search.all.length) return null
  const videoInfo = videoMatch ? search.videos.find(v => v.videoId === videoMatch[1]) || search.all[0] : search.all[0]
  return videoInfo || null
}

// 🔥 FUNCIÓN MÁGICA PARA CONVERTIR MP3 A OGG(OPUS) PARA WHATSAPP
function toAudio(buffer, ext) {
  return new Promise((resolve, reject) => {
    let tmp = `./tmp_${Date.now()}.${ext}`
    let out = tmp + '.ogg'
    fs.writeFileSync(tmp, buffer)
    exec(`ffmpeg -i ${tmp} -vn -c:a libopus -b:a 128k -vbr on -compression_level 10 ${out}`, (err, stderr, stdout) => {
      fs.unlinkSync(tmp)
      if (err) return reject(err)
      let opusBuffer = fs.readFileSync(out)
      fs.unlinkSync(out)
      resolve(opusBuffer)
    })
  })
}

export default {
  command: ['play', 'mp3', 'ytmp3', 'ytaudio', 'playaudio'],
  category: 'downloader',
  run: async (client, m, args, usedPrefix, command) => {
    try {
      if (!args[0]) {
        return m.reply('《✧》Por favor, menciona el nombre o URL del video que deseas descargar')
      }
      
      const text = args.join(' ')
      const videoMatch = text.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/|live\/|v\/))([a-zA-Z0-9_-]{11})/)
      const query = videoMatch ? 'https://youtu.be/' + videoMatch[1] : text
      let url = query, title = null, thumbBuffer = null

      try {
        const videoInfo = await getVideoInfo(query, videoMatch)
        if (videoInfo) {
          url = videoInfo.url
          title = videoInfo.title
          thumbBuffer = await getBuffer(videoInfo.image)
          const vistas = (videoInfo.views || 0).toLocaleString()
          const canal = videoInfo.author?.name || 'Desconocido'
          const infoMessage = `➩ Descargando › ${title}

> ❖ Canal › *${canal}*
> ⴵ Duración › *${videoInfo.timestamp || 'Desconocido'}*
> ❀ Vistas › *${vistas}*
> ✩ Publicado › *${videoInfo.ago || 'Desconocido'}*
> ❒ Enlace › *${url}*`
          await client.sendMessage(m.chat, { image: thumbBuffer, caption: infoMessage }, { quoted: m })
        }
      } catch (err) {
        console.error("Error al obtener info del video:", err)
      }

      const audio = await getAudioFromApis(url)
      
      if (!audio?.url) {
        return m.reply('《✧》 No se pudo descargar el *audio*, intenta más tarde o verifica el enlace.')
      }

      // Descargamos el MP3 de la API
      const mp3Buffer = await getBuffer(audio.url)
      
      // 🔥 LO CONVERTIMOS A FORMATO NOTA DE VOZ DE WHATSAPP
      const opusBuffer = await toAudio(mp3Buffer, 'mp3')
      
      await client.sendMessage(m.chat, { 
        audio: opusBuffer, 
        mimetype: 'audio/ogg; codecs=opus',
        ptt: true // Ahora sí es una nota de voz real
      }, { quoted: m })

    } catch (e) {
      console.error(e)
      await m.reply(`> Ocurrió un error inesperado al ejecutar *${usedPrefix + command}*.\n> [Error: *${e.message}*]`)
    }
  }
}

async function getAudioFromApis(url) {
  const apis = [
    { 
      api: 'EvoGB', 
      endpoint: `https://api.evogb.org/dl/ytmp3?url=${encodeURIComponent(url)}&key=Alba070503`, 
      extractor: res => res?.data?.dl 
    }
  ]

  for (const { api, endpoint, extractor } of apis) {
    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 20000) 
      
      const response = await fetch(endpoint, { signal: controller.signal })
      const res = await response.json()
      
      clearTimeout(timeout)
      
      const link = extractor(res)
      if (link) return { url: link, api }
      
    } catch (e) {
      console.error(`Fallo en la API ${api}:`, e.message)
    }
  }
  
  return null
}
