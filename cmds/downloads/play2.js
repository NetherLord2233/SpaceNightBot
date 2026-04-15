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
          
          // 🔥 NUEVO FORMATO DE MENSAJE BASADO EN TU EJEMPLO
          const infoMessage = `*${title}*\n*⇄ㅤ     ◁   ㅤ  ❚❚ㅤ     ▷ㅤ     ↻*\n\n*⏰ Duración:* ${videoInfo.timestamp || 'Desconocido'}\n*👉🏻 Aguarde un momento en lo que envío su video*`
          
          await client.sendMessage(m.chat, { image: thumbBuffer, caption: infoMessage }, { quoted: m })
        }
      } catch (err) {
        console.error("Error al obtener info del video:", err)
      }

      // Pedimos el enlace a la nueva lista de APIs
      const video = await getVideoFromApis(url, title)
      
      if (!video?.url) {
        return m.reply('《✧》 No se pudo descargar el *video*, las APIs están caídas. Intenta más tarde.')
      }

      // 🔥 ENVÍO DIRECTO POR URL PARA EVITAR CORRUPCIÓN DE ARCHIVO
      await client.sendMessage(m.chat, { 
        video: { url: video.url }, 
        caption: `> 🎥 *${title || 'Video'}*\n> Descargado vía: ${video.api}`,
        fileName: `${title || 'video'}.mp4`, 
        mimetype: 'video/mp4' 
      }, { quoted: m })

    } catch (e) {
      console.error(e)
      await m.reply(`> Ocurrió un error inesperado al ejecutar *${usedPrefix + command}*.\n> [Error: *${e.message}*]`)
    }
  }
}

// 🔥 LISTA DE APIS EXTRAÍDAS DEL EJEMPLO Y FUSIONADAS
async function getVideoFromApis(url, title = "") {
  const apis = [
    // La API de EvoGB que ya teníamos como principal
    { 
      api: 'EvoGB', 
      endpoint: `https://api.evogb.org/dl/youtubeplay?query=${encodeURIComponent(url)}&type=video&quality=480&key=Alba070503`, 
      extractor: res => res?.data?.download?.url 
    },
    // Nuevas APIs extraídas del código de ejemplo
    { 
      api: 'Siputzx', 
      endpoint: `https://api.siputzx.my.id/api/d/ytmp4?url=${encodeURIComponent(url)}`, 
      extractor: res => res?.dl 
    },
    { 
      api: 'Neoxr', 
      endpoint: `https://api.neoxr.eu/api/youtube?url=${encodeURIComponent(url)}&type=video&quality=720p&apikey=GataDios`, 
      extractor: res => res?.data?.url 
    },
    { 
      api: 'Fgmods', 
      endpoint: `https://api.fgmods.xyz/api/downloader/ytmp4?url=${encodeURIComponent(url)}&apikey=elrebelde21`, 
      extractor: res => res?.result?.dl_url 
    },
    { 
      api: 'Exonity', 
      // Exonity usa el título de la canción en lugar de la URL según el código de ejemplo
      endpoint: `https://exonity.tech/api/dl/playmp4?query=${encodeURIComponent(title || url)}`, 
      extractor: res => res?.result?.download 
    }
  ]

  // Bucle que intenta descargar de una API, y si falla, pasa a la siguiente
  for (const { api, endpoint, extractor } of apis) {
    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 20000) // 20 segundos por API
      
      const response = await fetch(endpoint, { signal: controller.signal })
      const res = await response.json()
      
      clearTimeout(timeout)
      
      const link = extractor(res)
      if (link) {
        console.log(`✅ Enlace encontrado usando API: ${api}`)
        return { url: link, api }
      }
      
    } catch (e) {
      console.log(`❌ Fallo en la API ${api}:`, e.message)
    }
  }
  
  return null
}
