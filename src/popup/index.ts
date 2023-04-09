import './index.css'
import sessionAttendance from './sessionAttendance'
interface InfoByOrigin {
  [key: string]: {
    courseId?: string
    authToken?: string
    dataUrl?: string
    referrerUrl?: string
    headers?: chrome.webRequest.HttpHeader[]
  }
}

let infoByOrigin: InfoByOrigin = {}

document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
  <main>
    <button id="session">Generate Attendance by session</button><br />
    <button id="student" disabled>Generate Attendance by student</button>
  </main>
`

document.querySelector<HTMLButtonElement>('#session')?.addEventListener('click', async (event) => {
  const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true })
  if (!tab?.url) return
  const origin = generateOriginUrl(tab.url)
  console.log({ origin })

  if (!infoByOrigin[origin]) infoByOrigin[origin] = {}
  const currentInfo = infoByOrigin[origin]
  const { courseId, authToken, headers, dataUrl, referrerUrl } = currentInfo

  if (courseId && authToken && headers && dataUrl && referrerUrl) {
    const fetchHeaders = new Headers()
    headers.forEach((header) => {
      if (header.value) {
        fetchHeaders.append(header.name, header.value)
      }
    })
    sessionAttendance(fetchHeaders, courseId, dataUrl, referrerUrl)
  } else {
    scrapeRequestInfo(origin)
  }
})

function generateOriginUrl(tabUrl: string) {
  const url = new URL(tabUrl)
  const hostParts = url.host.split('.')
  let origin = `${url.protocol}//*.`
  if (hostParts.length > 2) {
    origin = `${origin}${hostParts[1]}.${hostParts[2]}/`
  } else {
    origin = `${origin}${hostParts[0]}.${hostParts[2]}/`
  }

  return origin
}

async function scrapeRequestInfo(origin: string) {
  const granted: Boolean = await chrome.permissions.request({
    permissions: ['webRequest'],
    origins: [origin],
  })

  if (granted) {
    if (!chrome.webRequest.onBeforeRequest.hasListener(getCourseIdFromBeforeRequest)) {
      chrome.webRequest.onBeforeRequest.addListener(
        getCourseIdFromBeforeRequest,
        { urls: [`${origin}*/attendance/*`, `${origin}*/attendance/*/`] },
        ['requestBody'],
      )
      console.log('Added listener for courseId')
    }

    if (!chrome.webRequest.onBeforeSendHeaders.hasListener(getHeadersFromBeforeSendHeaders)) {
      chrome.webRequest.onBeforeSendHeaders.addListener(
        getHeadersFromBeforeSendHeaders,
        { urls: [`${origin}*/attendance/*`, `${origin}*/attendance/*/`] },
        ['requestHeaders', 'extraHeaders'],
      )
      console.log('Added listener for authToken')
    }
  } else {
    console.log('Permissions not granted')
  }

  function getCourseIdFromBeforeRequest(details: chrome.webRequest.WebRequestBodyDetails) {
    if (details.method == 'POST' && details.requestBody?.raw?.[0]?.bytes) {
      const requestBody = JSON.parse(
        String.fromCharCode.apply(null, [...new Uint8Array(details.requestBody.raw[0].bytes)]),
      )
      if (requestBody?.courseId) {
        console.log('courseId', { details })
        infoByOrigin[origin].courseId = requestBody?.courseId
        infoByOrigin[origin].dataUrl = details.url.replace(/\/(students|sessions)\/?$/i, '')
        infoByOrigin[origin].referrerUrl = details.initiator
        console.log(`Found courseId: ${infoByOrigin[origin].courseId}`)
        chrome.webRequest.onBeforeRequest.removeListener(getCourseIdFromBeforeRequest)
      }
    }
  }

  function getHeadersFromBeforeSendHeaders(details: chrome.webRequest.WebRequestHeadersDetails) {
    if (details.method == 'POST' && details.requestHeaders?.length) {
      const requestHeaders = details.requestHeaders
      const authToken = requestHeaders.find(
        (header) => header.name.toLocaleLowerCase() === 'authtoken',
      )?.value
      if (authToken) {
        console.log('authoken', { details })
        infoByOrigin[origin].headers = requestHeaders
        infoByOrigin[origin].authToken = authToken
        console.log(`Found authToken: ${authToken.slice(0, 5)}....`)
        chrome.webRequest.onBeforeSendHeaders.removeListener(getHeadersFromBeforeSendHeaders)
      }
    }
  }
}
