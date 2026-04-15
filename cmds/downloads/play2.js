import yts from 'yt-search'
import axios from 'axios'
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
          
          const infoMessage = `➩ Descargando › *${title}*

> ❖ Canal › *${videoInfo.author?.name || 'Desconocido'}*
> ⴵ Duración › *${videoInfo.timestamp || 'Desconocido'}*
> ❀ Vistas › *${(videoInfo.views || 0).toLocaleString()}*
> ✩ Publicado › *${videoInfo.ago || 'Desconocido'}*
> ❒ Enlace › *${url}*`

          await client.sendMessage(m.chat, { image: thumbBuffer, caption: infoMessage }, { quoted: m })
        }
      } catch (err) {
        console.error("Error al obtener info del video:", err)
      }

      // 🔥 USAMOS LA API QUE SÍ ENTREGA H.264 + AAC
      const video = await getVideoFromApis(url)
      
      if (!video?.url) {
        return m.reply('《✧》 No se pudo obtener el enlace de descarga compatible. Intenta más tarde.')
      }

      await m.reply('⏳ Procesando video en formato H.264 compatible con WhatsApp...')

      const response = await axios({
        method: 'get',
        url: video.url,
        responseType: 'arraybuffer',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': '*/*'
        }
      })

      const videoBuffer = Buffer.from(response.data)

      const checkContent = videoBuffer.toString('utf-8', 0, 100).toLowerCase()
      if (checkContent.includes('<!doctype html>') || checkContent.includes('<html')) {
         return m.reply('❌ El servidor bloqueó la descarga temporalmente.')
      }

      if (videoBuffer.length < 50000) {
        return m.reply('❌ El archivo está dañado.')
      }

      // 🔥 ENVIAR COMO VIDEO NORMAL (Ya debería abrir directamente en el chat)
      await client.sendMessage(m.chat, { 
        video: videoBuffer, 
        mimetype: 'video/mp4',
        fileName: `${title || 'video'}.mp4`,
        caption: `> 🎥 *${title || 'Video'}*`
      }, { quoted: m })

    } catch (e) {
      console.error(e)
      await m.reply(`> Error crítico: *${e.message}*`)
    }
  }
}

async function getVideoFromApis(url) {
  try {
    // 🔥 CAMBIAMOS A SIPUTZX: Esta API es famosa por entregar el códec correcto para WhatsApp
    const endpoint = `https://api.siputzx.my.id/api/d/ytmp4?url=${encodeURIComponent(url)}`
    const res = await axios.get(endpoint)
    
    if (res.data?.dl) {
      return { url: res.data.dl }
    }
  } catch (e) {
    console.log("Error en API Siputzx:", e.message)
  }
  return null
}
