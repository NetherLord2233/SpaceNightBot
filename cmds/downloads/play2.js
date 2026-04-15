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

      // Pedimos el enlace a la API
      const video = await getVideoFromApis(url)
      
      if (!video?.url) {
        return m.reply('《✧》 No se pudo descargar el *video*, intenta más tarde o verifica el enlace.')
      }

      // 🔥 FETCH ESTRICTO CON VERIFICACIÓN DE TIPO DE ARCHIVO
      const response = await fetch(video.url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': '*/*',
          'Referer': 'https://api.evogb.org/'
        }
      })
      
      // Verificamos qué tipo de archivo nos entregó el servidor
      const contentType = response.headers.get('content-type')
      if (!contentType || !contentType.includes('video')) {
        console.log("El servidor devolvió un tipo incorrecto:", contentType);
        return m.reply('《✧》 El servidor bloqueó la descarga (Protección anti-bots) o el archivo es muy pesado. Intenta con un video más corto.')
      }

      const arrayBuffer = await response.arrayBuffer()
      const videoBuffer = Buffer.from(arrayBuffer)

      // ENVIAMOS EL ARCHIVO COMO VIDEO MP4
      await client.sendMessage(m.chat, { 
        video: videoBuffer, 
        caption: `> 🎥 *${title || 'Video'}*`,
        fileName: `${title || 'video'}.mp4`, 
        mimetype: 'video/mp4' 
      }, { quoted: m })

    } catch (e) {
      console.error(e)
      await m.reply(`> Ocurrió un error inesperado al ejecutar *${usedPrefix + command}*.\n> [Error: *${e.message}*]`)
    }
  }
}

async function getVideoFromApis(url) {
  const apis = [
    { 
      api: 'EvoGB_Video', 
      // 🔥 BAJAMOS A 360p (quality=360) PARA NO ROMPER LOS LÍMITES DE WHATSAPP
      endpoint: `https://api.evogb.org/dl/youtubeplay?query=${encodeURIComponent(url)}&type=video&quality=360&key=Alba070503`, 
      extractor: res => res?.data?.download?.url 
    }
  ]

  for (const { api, endpoint, extractor } of apis) {
    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 35000) // 35s, los videos toman tiempo
      
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
