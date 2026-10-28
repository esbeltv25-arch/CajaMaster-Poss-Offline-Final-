package com.cajamaster.pos;

import android.Manifest;
import android.content.ClipData;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.net.wifi.WifiManager;
import android.os.Build;
import android.util.Base64;
import android.util.Log;
import android.webkit.MimeTypeMap;
import androidx.core.content.ContextCompat;
import androidx.core.content.FileProvider;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import java.io.File;
import java.io.FileOutputStream;
import java.net.Inet4Address;
import java.net.InetAddress;
import java.net.NetworkInterface;
import java.util.Collections;
import java.util.List;

@CapacitorPlugin(
    name = "CajaNative",
    permissions = {
        @Permission(
            alias = "camera",
            strings = { Manifest.permission.CAMERA }
        )
    }
)
public class CajaNativePlugin extends Plugin {

    private static final String TAG = "CajaNativePlugin";
    private static SyncRelayServer syncServerInstance = null;
    private static int syncServerPort = 8787;

    @PluginMethod
    public void checkCameraPermission(PluginCall call) {
        boolean granted = ContextCompat.checkSelfPermission(
                getContext(),
                Manifest.permission.CAMERA
        ) == PackageManager.PERMISSION_GRANTED;

        JSObject ret = new JSObject();
        ret.put("granted", granted);
        call.resolve(ret);
    }

    @PluginMethod
    public void requestCameraPermission(PluginCall call) {
        if (ContextCompat.checkSelfPermission(getContext(), Manifest.permission.CAMERA)
                == PackageManager.PERMISSION_GRANTED) {
            JSObject ret = new JSObject();
            ret.put("granted", true);
            call.resolve(ret);
            return;
        }

        requestPermissionForAlias("camera", call, "cameraPermissionCallback");
    }

    @PermissionCallback
    private void cameraPermissionCallback(PluginCall call) {
        boolean granted = ContextCompat.checkSelfPermission(
                getContext(),
                Manifest.permission.CAMERA
        ) == PackageManager.PERMISSION_GRANTED;

        JSObject ret = new JSObject();
        ret.put("granted", granted);
        call.resolve(ret);
    }

    @PluginMethod
    public void getLocalIpAddress(PluginCall call) {
        String ip = findLocalIpAddress();
        JSObject ret = new JSObject();
        ret.put("ip", ip != null ? ip : "127.0.0.1");
        call.resolve(ret);
    }

    @PluginMethod
    public void startSyncServer(PluginCall call) {
        int port = call.getInt("port", 8787);
        try {
            if (syncServerInstance != null) {
                try {
                    syncServerInstance.stop();
                } catch (Exception ignored) {}
                syncServerInstance = null;
            }

            syncServerInstance = new SyncRelayServer(port);
            syncServerInstance.start();
            syncServerPort = port;

            String ip = findLocalIpAddress();
            Log.i(TAG, "Sync server started on " + ip + ":" + port);

            JSObject ret = new JSObject();
            ret.put("running", true);
            ret.put("port", port);
            ret.put("ip", ip != null ? ip : "127.0.0.1");
            call.resolve(ret);
        } catch (Exception e) {
            Log.e(TAG, "Error starting sync server", e);
            call.reject("Failed to start sync server: " + e.getMessage(), e);
        }
    }

    @PluginMethod
    public void stopSyncServer(PluginCall call) {
        try {
            if (syncServerInstance != null) {
                syncServerInstance.stop();
                syncServerInstance = null;
            }
            JSObject ret = new JSObject();
            ret.put("running", false);
            call.resolve(ret);
        } catch (Exception e) {
            Log.e(TAG, "Error stopping sync server", e);
            call.reject("Failed to stop sync server: " + e.getMessage(), e);
        }
    }

    @PluginMethod
    public void getSyncServerStatus(PluginCall call) {
        JSObject ret = new JSObject();
        boolean running = syncServerInstance != null;
        ret.put("running", running);
        ret.put("port", syncServerPort);
        ret.put("clientCount", syncServerInstance != null ? syncServerInstance.getClientCount() : 0);
        ret.put("ip", findLocalIpAddress());
        call.resolve(ret);
    }

    @PluginMethod
    public void share(PluginCall call) {
        String title = call.getString("title", "CajaMaster POS");
        String text = call.getString("text");
        String url = call.getString("url");
        String base64File = call.getString("base64File");
        String filename = call.getString("filename", "document.pdf");
        String mimeType = call.getString("mimeType", "application/pdf");
        String dialogTitle = call.getString("dialogTitle", "Compartir con CajaMaster");

        try {
            Intent intent = new Intent(Intent.ACTION_SEND);

            if (base64File != null && !base64File.isEmpty()) {
                // Decode file and write to application cache
                byte[] bytes = Base64.decode(base64File, Base64.DEFAULT);
                File cacheDir = new File(getContext().getCacheDir(), "shared_files");
                if (!cacheDir.exists()) {
                    cacheDir.mkdirs();
                }

                File tempFile = new File(cacheDir, filename);
                FileOutputStream fos = new FileOutputStream(tempFile);
                fos.write(bytes);
                fos.flush();
                fos.close();

                Uri contentUri = FileProvider.getUriForFile(
                        getActivity(),
                        getContext().getPackageName() + ".fileprovider",
                        tempFile
                );

                intent.setType(mimeType != null ? mimeType : "*/*");
                intent.putExtra(Intent.EXTRA_STREAM, contentUri);
                intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);

                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                    intent.setClipData(ClipData.newRawUri(title, contentUri));
                }
            } else {
                intent.setType("text/plain");
            }

            if (text != null && !text.isEmpty()) {
                String fullText = text;
                if (url != null && !url.isEmpty()) {
                    fullText = fullText + "\n" + url;
                }
                intent.putExtra(Intent.EXTRA_TEXT, fullText);
            } else if (url != null && !url.isEmpty()) {
                intent.putExtra(Intent.EXTRA_TEXT, url);
            }

            if (title != null && !title.isEmpty()) {
                intent.putExtra(Intent.EXTRA_SUBJECT, title);
            }

            Intent chooser = Intent.createChooser(intent, dialogTitle);
            chooser.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            chooser.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);

            getActivity().startActivity(chooser);

            JSObject ret = new JSObject();
            ret.put("success", true);
            ret.put("methodUsed", "nativeIntent");
            call.resolve(ret);
        } catch (Exception e) {
            Log.e(TAG, "Native share error", e);
            call.reject("Error launching native share dialog: " + e.getMessage(), e);
        }
    }

    @PluginMethod
    public void openExternalUrl(PluginCall call) {
        String urlString = call.getString("url");
        if (urlString == null || urlString.trim().isEmpty()) {
            call.reject("URL string cannot be empty");
            return;
        }

        try {
            Uri uri = Uri.parse(urlString.trim());
            Intent intent = new Intent(Intent.ACTION_VIEW, uri);
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);

            getActivity().startActivity(intent);

            JSObject ret = new JSObject();
            ret.put("success", true);
            call.resolve(ret);
        } catch (Exception e) {
            Log.e(TAG, "Error opening external URL: " + urlString, e);
            call.reject("Could not open external URL: " + e.getMessage(), e);
        }
    }

    @PluginMethod
    public void clearAppCache(PluginCall call) {
        try {
            getActivity().runOnUiThread(() -> {
                try {
                    if (getBridge() != null && getBridge().getWebView() != null) {
                        getBridge().getWebView().clearCache(true);
                    }
                    deleteDir(getContext().getCacheDir());
                    JSObject ret = new JSObject();
                    ret.put("success", true);
                    call.resolve(ret);
                } catch (Exception e) {
                    call.reject("Error clearing cache: " + e.getMessage(), e);
                }
            });
        } catch (Exception e) {
            call.reject("Error dispatching cache clear: " + e.getMessage(), e);
        }
    }

    private boolean deleteDir(File dir) {
        if (dir != null && dir.isDirectory()) {
            String[] children = dir.list();
            if (children != null) {
                for (String child : children) {
                    boolean success = deleteDir(new File(dir, child));
                    if (!success) return false;
                }
            }
            return dir.delete();
        } else if (dir != null && dir.isFile()) {
            return dir.delete();
        }
        return false;
    }

    private String findLocalIpAddress() {
        try {
            List<NetworkInterface> interfaces = Collections.list(NetworkInterface.getNetworkInterfaces());
            // 1. Prefer Wi-Fi or AP interfaces (wlan0, ap0, softap)
            for (NetworkInterface intf : interfaces) {
                String name = intf.getName().toLowerCase();
                if (name.contains("wlan") || name.contains("ap") || name.contains("swlan")) {
                    for (InetAddress addr : Collections.list(intf.getInetAddresses())) {
                        if (!addr.isLoopbackAddress() && addr instanceof Inet4Address) {
                            return addr.getHostAddress();
                        }
                    }
                }
            }

            // 2. Fallback to any non-loopback IPv4 address
            for (NetworkInterface intf : interfaces) {
                for (InetAddress addr : Collections.list(intf.getInetAddresses())) {
                    if (!addr.isLoopbackAddress() && addr instanceof Inet4Address) {
                        return addr.getHostAddress();
                    }
                }
            }
        } catch (Exception e) {
            Log.e(TAG, "Error finding local IP", e);
        }
        return "127.0.0.1";
    }
}
