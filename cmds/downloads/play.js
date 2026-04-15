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

      // Pedimos el enlace a la NUEVA API
      const audio = await getAudioFromApis(url)
      
      if (!audio?.url) {
        return m.reply('《✧》 No se pudo descargar el *audio*, intenta más tarde.')
      }

      // 🔥 FIX ANTICORRUPCIÓN: Descargamos con Fetch forzando un User-Agent real
      const response = await fetch(audio.url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': '*/*'
        }
      })
      
      const arrayBuffer = await response.arrayBuffer()
      const audioBuffer = Buffer.from(arrayBuffer)

      // Verificamos que el archivo sea una canción real (que pese más de 50KB)
      if (audioBuffer.length < 50000) {
        return m.reply('《✧》 El servidor de descarga bloqueó la solicitud. Intenta con otra canción o más tarde.')
      }

      // ENVIAMOS EL AUDIO COMO MP3 NORMAL (NO NOTA DE VOZ)
      await client.sendMessage(m.chat, { 
        audio: audioBuffer, 
        fileName: `${title || 'audio'}.mp3`, 
        mimetype: 'audio/mpeg' 
      }, { quoted: m })

    } catch (e) {
      console.error(e)
      await m.reply(`> An unexpected error occurred while executing command *${usedPrefix + command}*.\n> [Error: *${e.message}*]`)
    }
  }
}

async function getAudioFromApis(url) {
  const apis = [
    { 
      api: 'EvoGB_Play', 
      // 🔥 NUEVA RUTA DE LA API CON PARÁMETROS CORRECTOS
      endpoint: `https://api.evogb.org/dl/youtubeplay?query=${encodeURIComponent(url)}&type=audio&quality=auto&key=Alba070503`, 
      // 🔥 NUEVA RUTA DE EXTRACCIÓN SEGÚN TU JSON
      extractor: res => res?.data?.download?.url 
    }
  ]

  for (const { api, endpoint, extractor } of apis) {
    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 20000) // 20s para darle tiempo a la API
      
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
