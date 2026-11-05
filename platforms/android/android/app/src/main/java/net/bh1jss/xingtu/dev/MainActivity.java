package net.bh1jss.xingtu.dev;

import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceError;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.LinearLayout;
import android.widget.Button;
import android.widget.TextView;
import androidx.activity.OnBackPressedCallback;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;

/** Bundled five-tab UI, live HTTPS services, no native JavaScript bridge. */
public class MainActivity extends AppCompatActivity {
    private static final String HOME = "https://space.bh1jss.net/rocket-cloud/";
    private WebView web;
    private LinearLayout root;
    private LinearLayout errorPanel;
    private android.webkit.GeolocationPermissions.Callback locationCallback;
    private String locationOrigin;
    private android.webkit.ValueCallback<Uri[]> fileCallback;
    private Uri cameraOutput;
    private final androidx.activity.result.ActivityResultLauncher<Intent> photoPicker =
        registerForActivityResult(new androidx.activity.result.contract.ActivityResultContracts.StartActivityForResult(), result -> {
            Uri[] selected = null;
            if (result.getResultCode() == RESULT_OK) {
                Uri uri = result.getData() == null ? null : result.getData().getData();
                if (uri == null) uri = cameraOutput;
                if (uri != null) selected = new Uri[]{uri};
            }
            if (fileCallback != null) fileCallback.onReceiveValue(selected);
            fileCallback = null; cameraOutput = null;
        });
    private final androidx.activity.result.ActivityResultLauncher<String[]> locationPermissions =
        registerForActivityResult(new androidx.activity.result.contract.ActivityResultContracts.RequestMultiplePermissions(), result -> {
            boolean allowed = Boolean.TRUE.equals(result.get(android.Manifest.permission.ACCESS_FINE_LOCATION))
                || Boolean.TRUE.equals(result.get(android.Manifest.permission.ACCESS_COARSE_LOCATION));
            if (locationCallback != null) locationCallback.invoke(locationOrigin, allowed, false);
            locationCallback = null;
        });

    @Override public void onCreate(Bundle state) {
        androidx.core.splashscreen.SplashScreen.installSplashScreen(this);
        super.onCreate(state);
        root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setBackgroundColor(0xfff3f7f8);
        setContentView(root);
        ViewCompat.setOnApplyWindowInsetsListener(root, (view, insets) -> {
            androidx.core.graphics.Insets bars = insets.getInsets(
                WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.displayCutout() | WindowInsetsCompat.Type.ime());
            view.setPadding(bars.left, bars.top, bars.right, bars.bottom);
            return insets;
        });
        web = new WebView(this);
        web.setBackgroundColor(0xfff3f7f8);
        web.getSettings().setJavaScriptEnabled(true);
        web.getSettings().setDomStorageEnabled(true);
        try {
            android.content.pm.PackageInfo info = getPackageManager().getPackageInfo(getPackageName(), 0);
            web.getSettings().setUserAgentString(web.getSettings().getUserAgentString() + " Xingtu/android/" + info.versionName + "/" + androidx.core.content.pm.PackageInfoCompat.getLongVersionCode(info));
        } catch (android.content.pm.PackageManager.NameNotFoundException ignored) { }
        web.getSettings().setAllowFileAccess(false);
        web.getSettings().setAllowContentAccess(false);
        web.getSettings().setMixedContentMode(android.webkit.WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        web.getSettings().setSupportMultipleWindows(false);
        web.getSettings().setGeolocationEnabled(true);
        web.setWebChromeClient(new WebChromeClient() {
            @Override public boolean onShowFileChooser(WebView view, android.webkit.ValueCallback<Uri[]> callback, FileChooserParams params) {
                if (fileCallback != null) fileCallback.onReceiveValue(null);
                fileCallback = callback; cameraOutput = null;
                Intent gallery = new Intent(Intent.ACTION_GET_CONTENT).setType("image/*").addCategory(Intent.CATEGORY_OPENABLE);
                gallery.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, false);
                Intent chooser = Intent.createChooser(gallery, getString(R.string.report_photo_chooser));
                try {
                    Intent camera = new Intent(android.provider.MediaStore.ACTION_IMAGE_CAPTURE);
                    if (camera.resolveActivity(getPackageManager()) != null) {
                        java.io.File folder = new java.io.File(getCacheDir(), "report-photos"); folder.mkdirs();
                        java.io.File file = new java.io.File(folder, "capture.jpg");
                        cameraOutput = androidx.core.content.FileProvider.getUriForFile(MainActivity.this, getPackageName() + ".fileprovider", file);
                        camera.putExtra(android.provider.MediaStore.EXTRA_OUTPUT, cameraOutput);
                        camera.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_WRITE_URI_PERMISSION);
                        camera.setClipData(android.content.ClipData.newRawUri("photo", cameraOutput));
                        chooser.putExtra(Intent.EXTRA_INITIAL_INTENTS, new Intent[]{camera});
                    }
                    photoPicker.launch(chooser);
                } catch (Exception e) { callback.onReceiveValue(null); fileCallback = null; cameraOutput = null; }
                return true;
            }
            @Override public void onGeolocationPermissionsShowPrompt(String origin, android.webkit.GeolocationPermissions.Callback callback) {
                if (!"https://space.bh1jss.net".equals(origin) && !"https://space.bh1jss.net/".equals(origin)) {
                    callback.invoke(origin, false, false); return;
                }
                if (androidx.core.content.ContextCompat.checkSelfPermission(MainActivity.this, android.Manifest.permission.ACCESS_FINE_LOCATION) == android.content.pm.PackageManager.PERMISSION_GRANTED
                    || androidx.core.content.ContextCompat.checkSelfPermission(MainActivity.this, android.Manifest.permission.ACCESS_COARSE_LOCATION) == android.content.pm.PackageManager.PERMISSION_GRANTED) {
                    callback.invoke(origin, true, false); return;
                }
                if (locationCallback != null) locationCallback.invoke(locationOrigin, false, false);
                locationCallback = callback; locationOrigin = origin;
                locationPermissions.launch(new String[]{android.Manifest.permission.ACCESS_FINE_LOCATION, android.Manifest.permission.ACCESS_COARSE_LOCATION});
            }
            @Override public void onGeolocationPermissionsHidePrompt() { locationCallback = null; }
        });
        if ((getApplicationInfo().flags & android.content.pm.ApplicationInfo.FLAG_DEBUGGABLE) != 0) WebView.setWebContentsDebuggingEnabled(true);
        final androidx.webkit.WebViewAssetLoader assets = new androidx.webkit.WebViewAssetLoader.Builder()
            .setDomain("space.bh1jss.net")
            .addPathHandler("/rocket-cloud/", path -> {
                if (path.startsWith("api/")) return null;
                if (path.contains("..")) return null;
                String name = path.isEmpty() ? "index.html" : path;
                String mime = name.endsWith(".js") ? "text/javascript" : name.endsWith(".css") ? "text/css" : name.endsWith(".json") ? "application/json" : name.endsWith(".svg") ? "image/svg+xml" : name.endsWith(".png") ? "image/png" : "text/html";
                try { return new android.webkit.WebResourceResponse(mime, "UTF-8", getAssets().open("public/" + name)); }
                catch (java.io.IOException e) { return null; }
            }).build();
        web.setWebViewClient(new WebViewClient() {
            @Override public android.webkit.WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                if ("GET".equals(request.getMethod()) && "https".equals(uri.getScheme())
                    && "space.bh1jss.net".equals(uri.getHost()) && uri.getPath().startsWith("/rocket-cloud/api/")) {
                    // Keep API requests in Chromium: its cookies, redirects, proxy and TLS handling.
                    return null;
                }
                return assets.shouldInterceptRequest(uri);
            }
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                if (!request.isForMainFrame()) return false;
                Uri uri = request.getUrl();
                if ("https".equals(uri.getScheme()) && "space.bh1jss.net".equals(uri.getHost())
                    && uri.getPath() != null && uri.getPath().startsWith("/rocket-cloud/")) return false;
                if ("https".equals(uri.getScheme()) || "http".equals(uri.getScheme())) {
                    try { startActivity(new Intent(Intent.ACTION_VIEW, uri)); } catch (android.content.ActivityNotFoundException ignored) {}
                }
                return true;
            }
            @Override public void onPageFinished(WebView view, String url) {
                if (!url.startsWith(HOME)) return;
                try {
                    android.content.pm.PackageInfo info = getPackageManager().getPackageInfo(getPackageName(), 0);
                    String version = String.format(java.util.Locale.ROOT, "v%s %04d", info.versionName, androidx.core.content.pm.PackageInfoCompat.getLongVersionCode(info));
                    view.evaluateJavascript("document.querySelectorAll('.release-footer strong').forEach(el=>el.textContent=" + org.json.JSONObject.quote(version) + ")", null);
                } catch (android.content.pm.PackageManager.NameNotFoundException ignored) { }
            }
            @Override public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                if (request.isForMainFrame()) showError();
            }
        });
        root.addView(web, new LinearLayout.LayoutParams(-1, 0, 1));
        errorPanel = new LinearLayout(this);
        errorPanel.setOrientation(LinearLayout.VERTICAL);
        errorPanel.setPadding(32, 48, 32, 32);
        TextView message = new TextView(this);
        message.setText(R.string.load_error);
        message.setTextSize(18);
        Button retry = new Button(this);
        retry.setText(R.string.reload);
        retry.setOnClickListener(v -> { errorPanel.setVisibility(android.view.View.GONE); web.setVisibility(android.view.View.VISIBLE); web.loadUrl(HOME); });
        errorPanel.addView(message); errorPanel.addView(retry);
        errorPanel.setVisibility(android.view.View.GONE);
        root.addView(errorPanel);
        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override public void handleOnBackPressed() {
                web.evaluateJavascript("(()=>{const d=document.querySelector('dialog[open]');if(d){d.close();return true;}const p=document.getElementById('site-popover');if(p&&!p.hidden){document.getElementById('close-popover').click();return true;}if(document.body.dataset.mobilePage&&document.body.dataset.mobilePage!=='map'){document.querySelector('.mobile-nav [data-mobile-view=map]').click();return true;}return false;})()", result -> {
                    if (!"true".equals(result)) {
                        if (web.canGoBack()) web.goBack(); else finish();
                    }
                });
            }
        });
        if (state == null || web.restoreState(state) == null) web.loadUrl(HOME);
    }
    private void showError() { web.setVisibility(android.view.View.GONE); errorPanel.setVisibility(android.view.View.VISIBLE); }
    @Override protected void onSaveInstanceState(Bundle state) { web.saveState(state); super.onSaveInstanceState(state); }
    @Override protected void onPause() { web.evaluateJavascript("document.dispatchEvent(new CustomEvent('xingtu-visibility',{detail:false}))",null); web.onPause(); super.onPause(); }
    @Override protected void onResume() { super.onResume(); if (web != null) { web.onResume(); web.evaluateJavascript("document.dispatchEvent(new CustomEvent('xingtu-visibility',{detail:true}))",null); } }
    @Override protected void onDestroy() { root.removeView(web); web.destroy(); super.onDestroy(); }
}
