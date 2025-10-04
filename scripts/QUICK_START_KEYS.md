# ⚡ Быстрый старт: Генерация ключей

## 🚀 Одна команда для запуска

### Windows (PowerShell) - РЕКОМЕНДУЕТСЯ для Windows:
```powershell
.\scripts\generate-key-ids.ps1
```

### Windows (CMD):
```cmd
scripts\generate-key-ids.bat
```

### Linux/macOS:
```bash
bash scripts/generate-security-keys.sh
```

### Любая платформа с Node.js:
```bash
node scripts/generate-key-ids.js
```

## 📝 Что делать дальше?

1. **Скопируйте** все строки из вывода скрипта
2. **Откройте** файл `backend/.env` (или создайте если нет)
3. **Вставьте** скопированные строки в конец файла
4. **Сохраните** файл
5. **Перезапустите** приложение

## ✅ Результат

После этого предупреждения в консоли исчезнут:
- ~~Generated temporary key ID for security-logs~~
- ~~Generated temporary key ID for sbom-signing~~
- ~~Generated temporary key ID for communication~~
- ~~Generated temporary key ID for websocket~~
- ~~Generated temporary key ID for backup~~
- ~~Generated temporary key ID for storage~~
- ~~Generated temporary key ID for log~~

## ⚠️ ВАЖНО

- 🔒 **НИКОГДА** не коммитьте `.env` файлы в Git!
- 📋 Сохраните ключи в безопасном месте (password manager)
- 🔄 Используйте разные ключи для dev и production

## 🆘 Проблемы?

**Ошибка "openssl not found":**
```bash
# Ubuntu/Debian
sudo apt-get install openssl

# macOS  
brew install openssl
```

**Ошибка "node not found":**
- Скачайте с https://nodejs.org/

**Предупреждения не исчезли:**
1. Проверьте что ключи в файле `backend/.env`
2. Убедитесь что нет опечаток в именах переменных
3. Полностью перезапустите приложение (Ctrl+C и заново)

---

💡 **Подсказка:** Скрипт спросит, сохранить ли ключи в файл `.env.keys`. 
Если ответите "y", то потом просто скопируйте содержимое этого файла в `backend/.env` и удалите `.env.keys`.

