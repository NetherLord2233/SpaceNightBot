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
  command: ['play2', 'mp4', 'ytmp4', 'ytvideo', 'playvideo'],
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

          // FORMATO ORIGINAL DE TU BOT
          const infoMessage = `➩ Descargando › *${title}*

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

      // Obtenemos el link de las nuevas APIs
      const video = await getVideoFromApis(url, title)
      
      if (!video?.url) {
        return m.reply('《✧》 No se pudo descargar el *video*, las APIs están temporalmente caídas. Intenta más tarde.')
      }

      // ENVÍO DIRECTO POR URL PARA EVITAR ERRORES DE MEMORIA
      await client.sendMessage(m.chat, { 
        video: { url: video.url }, 
        fileName: `${title || 'video'}.mp4`, 
        mimetype: 'video/mp4' 
      }, { quoted: m })

    } catch (e) {
      console.error(e)
      await m.reply(`> An unexpected error occurred while executing command *${usedPrefix + command}*. Please try again or contact support if the issue persists.\n> [Error: *${e.message}*]`)
    }
  }
}

// 🔥 SISTEMA DE APIS CON MITZUKI COMO PRINCIPAL (EVOGB ELIMINADO)
async function getVideoFromApis(url, title = "") {
  const apis = [
    { 
      api: 'Mitzuki', 
      endpoint: `https://api.mitzuki.xyz/api/downloader/ytmp4?url=${encodeURIComponent(url)}&apikey=elrebelde21`, 
      // Extracción basada en tu JSON: data.media.dl_download
      extractor: res => res?.data?.media?.dl_download || res?.data?.media?.dl_inline
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
      if (link) {
        console.log(`✅ Video descargado usando API: ${api}`)
        return { url: link }
      }
      
    } catch (e) {
      console.log(`❌ Fallo en la API ${api}:`, e.message)
    }
  }
  
  return null
}
