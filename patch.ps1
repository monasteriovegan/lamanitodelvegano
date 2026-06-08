$c = Get-Content 'index.txt' -Raw -Encoding UTF8
$idx = $c.IndexOf('<script>')
$html = $c.Substring(0, $idx)
$html += '<script src="app.js"></script>' + "`n" + '</body>' + "`n" + '</html>'
$html = $html -replace '</style>\s*</head>', "</style>`n<!-- Firebase SDK -->`n<script src=`"https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js`"></script>`n<script src=`"https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore-compat.js`"></script>`n</head>"
Set-Content 'index.html' $html -Encoding UTF8
