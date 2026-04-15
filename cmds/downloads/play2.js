import yts from 'yt-search'
import axios from 'axios'
import fs from 'fs'
import { exec } from 'child_process'
import { getBuffer } from '../../core/message.js'

const isYTUrl = (url) => /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+$/i.test(url)

async function getVideoInfo(query, videoMatch) {
  const search = await yts(query)
  if (!search.all.length) return null
  const videoInfo = videoMatch ? search.videos.find(v => v.videoId === videoMatch[1]) || search.all[0] : search.all[0]
  return videoInfo || null
}

// 🔥 FUNCIÓN MÁGICA CON FFMPEG PARA FORZAR H.264 y AAC
function convertToWhatsAppFormat(inputPath, outputPath) {
  return new Promise((resolve, reject) => {
    // scale=... asegura que el video no sea más grande que 480p (ahorra peso)
    // -preset superfast hace que la conversión no sature la CPU de tu servidor
    const command = `ffmpeg -i "${inputPath}" -c:v libx264 -c:a aac -preset superfast -crf 28 -b:a 128k -vf "scale='min(854,iw)':'min(480,ih)':force_original_aspect_ratio=decrease" -y "${outputPath}"`
    
    exec(command, (error, stdout, stderr) => {
      if (error) {
        console.error("Error en FFmpeg:", error)
        return reject(error)
      }
      resolve()
    })
  })
}

export default {
  command: ['play2', 'mp4', 'ytmp4', 'ytvideo', 'playvideo'],
  category: 'downloader',
  run: async (client, m, args, usedPrefix, command) => {
    // Variables para los archivos temporales
    let tempInput = `./tmp_in_${Date.now()}.mp4`
    let tempOutput = `./tmp_out_${Date.now()}.mp4`

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

      // Usamos una API estable cualquiera, total FFmpeg arreglará el archivo
      const video = await getVideoFromApis(url)
      
      if (!video?.url) {
        return m.reply('《✧》 No se pudo obtener el enlace de descarga de la API.')
      }

      await m.reply('⏳ Convirtiendo y optimizando el video a formato de WhatsApp con FFmpeg...')

      // 1. Descargamos el video bruto de la API
      const response = await axios({
        method: 'get',
        url: video.url,
        responseType: 'arraybuffer',
        headers: { 'User-Agent': 'Mozilla/5.0' }
      })

      const rawBuffer = Buffer.from(response.data)

      if (rawBuffer.length < 50000) {
        return m.reply('❌ El archivo de origen está corrupto.')
      }

      // 2. Guardamos el video bruto en tu servidor temporalmente
      fs.writeFileSync(tempInput, rawBuffer)

      // 3. Ejecutamos FFmpeg para convertirlo a H.264 + AAC
      await convertToWhatsAppFormat(tempInput, tempOutput)

      // 4. Leemos el video ya convertido
      const finalVideoBuffer = fs.readFileSync(tempOutput)

      // 5. Enviamos a WhatsApp. ¡Ahora sí lo abrirá sin chistar!
      await client.sendMessage(m.chat, { 
        video: finalVideoBuffer, 
        mimetype: 'video/mp4',
        fileName: `${title || 'video'}.mp4`,
        caption: `> 🎥 *${title || 'Video'}*`
      }, { quoted: m })

    } catch (e) {
      console.error(e)
      await m.reply(`> Error al procesar el video: *${e.message}*\n> (Asegúrate de que FFmpeg esté instalado en el servidor)`)
    } finally {
      // 🧹 LIMPIEZA: Borramos los archivos temporales para no llenar el disco duro
      if (fs.existsSync(tempInput)) fs.unlinkSync(tempInput)
      if (fs.existsSync(tempOutput)) fs.unlinkSync(tempOutput)
    }
  }
}

async function getVideoFromApis(url) {
  try {
    const endpoint = `https://api.siputzx.my.id/api/d/ytmp4?url=${encodeURIComponent(url)}`
    const res = await axios.get(endpoint)
    if (res.data?.dl) return { url: res.data.dl }
  } catch (e) {
    console.log("Error API:", e.message)
  }
  return null
}
