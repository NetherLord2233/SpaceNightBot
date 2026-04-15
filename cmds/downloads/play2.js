import yts from 'yt-search'
import axios from 'axios'
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

      // Obtenemos el link de la API única solicitada (Zenzxz)
      const video = await getVideoFromApis(url)
      
      if (!video?.url) {
        return m.reply('《✧》 No se pudo obtener el enlace de descarga. Intenta más tarde.')
      }

      await m.reply('⏳ Descargando video como documento para evitar errores, espera un momento...')

      // Descarga pesada con Axios
      const response = await axios({
        method: 'get',
        url: video.url,
        responseType: 'arraybuffer',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36',
          'Accept': '*/*'
        }
      })

      const videoBuffer = Buffer.from(response.data)

      if (videoBuffer.length < 50000) {
        return m.reply('《✧》 El archivo descargado está corrupto o vacío.')
      }

      // 🔥 ENVIAR COMO DOCUMENTO (Esto soluciona el error de "no abre")
      await client.sendMessage(m.chat, { 
        document: videoBuffer, 
        mimetype: 'video/mp4',
        fileName: `${title || 'video'}.mp4`,
        caption: `> 🎥 *${title || 'Video'}*\n> Enviado como documento para asegurar la calidad.`
      }, { quoted: m })

    } catch (e) {
      console.error(e)
      await m.reply(`> Error al procesar el documento: *${e.message}*`)
    }
  }
}

async function getVideoFromApis(url) {
  try {
    // Usamos el formato 480p como pediste
    const endpoint = `https://api.zenzxz.my.id/download/youtube?url=${encodeURIComponent(url)}&format=480`
    const res = await fetch(endpoint).then(r => r.json())
    
    if (res.status && res.result?.download) {
      return { url: res.result.download }
    }
  } catch (e) {
    console.log("Error en API Zenzxz:", e.message)
  }
  return null
}
