console.info('chrome-ext template-vanilla-ts background script')

chrome.runtime.onMessage.addListener(async (request, sender, sendResponse) => {
  console.log({ request })
})

export {}
