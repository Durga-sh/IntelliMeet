# Troubleshooting Guide - Video Call Connection Issues

## Issue: "Failed to join the call" Error

This error occurs when:
1. Backend server is not running
2. Camera/Microphone permissions are denied
3. Network connection issues
4. MongoDB is not running

---

## ✅ Steps to Fix

### 1. **Start MongoDB**
Ensure MongoDB is running on your system.

**Windows:**
```bash
# Check if MongoDB service is running
net start MongoDB

# Or start it manually
mongod
```

**Mac/Linux:**
```bash
# Start MongoDB
brew services start mongodb-community
# OR
sudo systemctl start mongod
```

---

### 2. **Start Backend Server**

```bash
cd d:\Intellimeet2\IntelliMeet\Backend
npm run dev
```

**Expected Output:**
```
Server running on port 5000
Connecting to MongoDB...
MongoDB connected successfully
Creating X mediasoup workers...
Mediasoup workers created successfully
Mediasoup initialized successfully
Socket.io service initialized successfully
```

**If you see errors:**
- Check if port 5000 is available
- Ensure MongoDB connection string is correct in `.env`
- Verify all dependencies are installed: `npm install`

---

### 3. **Start Frontend Server**

```bash
cd d:\Intellimeet2\IntelliMeet\Frontend
npm run dev
```

**Expected Output:**
```
VITE v6.0.0 ready in XXX ms

➜  Local:   http://localhost:5173/
➜  Network: use --host to expose
```

---

### 4. **Test Camera/Microphone Permissions**

1. Open browser console (F12)
2. Run this test:
```javascript
navigator.mediaDevices.getUserMedia({ video: true, audio: true })
  .then(stream => {
    console.log("✅ Camera/Mic access granted!");
    stream.getTracks().forEach(track => track.stop());
  })
  .catch(error => {
    console.error("❌ Camera/Mic access denied:", error);
  });
```

**If denied:**
- Click the camera icon in browser address bar
- Allow camera and microphone permissions
- Refresh the page

---

### 5. **Check Environment Variables**

**Backend `.env`:**
```env
PORT=5000
MONGODB_URI=mongodb://localhost:27017/intellimeet
JWT_SECRET=your_jwt_secret_key_here
MEDIASOUP_ANNOUNCED_IP=127.0.0.1
FRONTEND_URL=http://localhost:5173
```

**Frontend `.env`:**
```env
VITE_API_URL=http://localhost:5000
VITE_SOCKET_URL=http://localhost:5000
```

---

### 6. **Test Connection**

1. Open: `http://localhost:5173`
2. Click "Join Room" button
3. Select "Create Room"
4. Enter your name
5. Click "Create & Join Room"

**Watch the browser console for:**
- ✅ "Connected to server"
- ✅ "Audio producer created"
- ✅ "Video producer created"

**If you see errors:**
- Check backend console for errors
- Verify WebSocket connection is established
- Check browser Network tab for failed requests

---

## 🎯 Current Improvements Made

### Error Handling Enhanced:
1. ✅ Better connection timeout handling (15 seconds)
2. ✅ Clear error messages for different scenarios:
   - "Cannot connect to server" - Backend not running
   - "No camera or microphone found" - Hardware issue
   - "Please grant permissions" - Permission denied
   - "Connection timeout" - Network/server issue

3. ✅ Graceful degradation:
   - Users can join without camera/mic
   - Can still view others and use chat
   - Shows placeholder avatar when camera is off

4. ✅ Loading state:
   - Shows "Connecting to room..." spinner
   - Better user feedback during connection

5. ✅ Warning banner:
   - Yellow warning shown if camera/mic unavailable
   - User can dismiss the warning
   - Can still participate in the call

---

## 🧪 Testing Checklist

- [ ] Backend server running
- [ ] Frontend server running
- [ ] MongoDB connected
- [ ] Browser permissions granted
- [ ] Can create a room
- [ ] Can join a room
- [ ] Video/audio working
- [ ] Chat working
- [ ] Screen share working

---

## 🚨 Common Issues

### Issue: "Cannot connect to server"
**Solution:** Start backend server

### Issue: "No camera or microphone found"
**Solution:** 
- Check if camera/mic are connected
- Check if another app is using them
- Try a different browser

### Issue: "Connection timeout"
**Solution:**
- Check firewall settings
- Verify both servers are running
- Check network connection

### Issue: MongoDB connection error
**Solution:**
- Start MongoDB service
- Check MongoDB URI in `.env`
- Ensure port 27017 is not blocked

---

## 📞 Support

If issues persist:
1. Check browser console (F12)
2. Check backend server logs
3. Verify all services are running
4. Try a different browser (Chrome recommended)

---

## ✨ Success Indicators

When everything works correctly:
- ✅ Room loads within 2-3 seconds
- ✅ Your video appears in the grid
- ✅ Participant count shows correctly
- ✅ Controls (mic, camera, screen) work
- ✅ Chat panel opens and messages send
- ✅ Other users can join and see you

---

## 🎉 You're Ready!

The application now handles errors gracefully and provides clear feedback. 
Users can join even without camera/mic access and still participate via chat.
