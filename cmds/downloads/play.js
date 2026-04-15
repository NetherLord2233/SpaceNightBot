import yts from 'yt-search'
import fetch from 'node-fetch'
import { getBuffer } from '../../core/message.js'

const isYTUrl = (url) => /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+$/i.test(url)

async function getVideoInfo(query, videoMatch) {
  const search = await yts(query)
  if (!search.all.length) return null
  const videoInfo = videoMatch ? search.videos.find(v => v.videoId === videoMatch[1]) || search.all[0] : search.all[0]
  return videoInfo || null
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

      // Llamamos a la nueva función con la API actualizada
      const audio = await getAudioFromApis(url)
      
      if (!audio?.url) {
        return m.reply('《✧》 No se pudo descargar el *audio*, intenta más tarde o verifica el enlace.')
      }

      const audioBuffer = await getBuffer(audio.url)
      
      await client.sendMessage(m.chat, { 
        audio: audioBuffer, 
        fileName: `${title || 'audio'}.mp3`, 
        mimetype: 'audio/mpeg' 
      }, { quoted: m })

    } catch (e) {
      await m.reply(`> Ocurrió un error inesperado al ejecutar *${usedPrefix + command}*.\n> [Error: *${e.message}*]`)
    }
  }
}

async function getAudioFromApis(url) {
  // Nueva API funcional inyectada aquí
  const apis = [
    { 
      api: 'EvoGB', 
      endpoint: `https://api.evogb.org/dl/ytmp3?url=${encodeURIComponent(url)}&key=Alba070503`, 
      // Según la documentación que pasaste, el enlace de descarga está en data.dl
      extractor: res => res?.data?.dl 
    }
  ]

  for (const { api, endpoint, extractor } of apis) {
    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 15000) // Aumenté el timeout a 15s por si la API demora en procesar
      
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
