import asyncio
from telegram import Update
from telegram.ext import ApplicationBuilder, ContextTypes, CommandHandler, MessageHandler, filters

# 1단계에서 받은 토큰을 여기에 넣으세요
TOKEN = '8698145930:AAFa01G4lfiy22AVfxpvDn4Euqt8rZ91kxQ'

# /start 명령어를 받았을 때 실행할 함수
async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await context.bot.send_message(chat_id=update.effective_chat.id, text="안녕하세요! 봇이 연결되었습니다.")

# 사용자가 보낸 메시지를 그대로 메아리(Echo)하는 함수
async def echo(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await context.bot.send_message(chat_id=update.effective_chat.id, text=update.message.text)

if __name__ == '__main__':
    # 봇 애플리케이션 생성
    application = ApplicationBuilder().token(TOKEN).build()
    
    # 명령어 핸들러 추가 (/start)
    start_handler = CommandHandler('start', start)
    application.add_handler(start_handler)
    
    # 일반 메시지 핸들러 추가 (텍스트 메시지 인식)
    echo_handler = MessageHandler(filters.TEXT & (~filters.COMMAND), echo)
    application.add_handler(echo_handler)
    
    print("봇이 실행 중입니다... (Ctrl+C로 종료)")
    application.run_polling()