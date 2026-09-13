; CopyGuard NSIS installer customization
; This file is included by electron-builder's NSIS build

; Custom welcome text
!define MUI_WELCOMEPAGE_TITLE "Welcome to CopyGuard"
!define MUI_WELCOMEPAGE_TEXT "CopyGuard is an AI-powered copy trading browser for Padre Terminal.$\r$\n$\r$\nThis installer will set up CopyGuard on your computer. No additional software required — everything is included.$\r$\n$\r$\nClick Next to continue."

; Custom finish text  
!define MUI_FINISHPAGE_TITLE "CopyGuard is Ready"
!define MUI_FINISHPAGE_TEXT "CopyGuard has been installed.$\r$\n$\r$\nOn first launch, click 'Yes, walk me through it' for a guided setup tour.$\r$\n$\r$\nYou will need:$\r$\n• Helius API key (free at helius.dev)$\r$\n• One AI key (Anthropic / OpenAI / Gemini / Grok)"
