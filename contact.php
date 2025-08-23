<?php
if ($_SERVER["REQUEST_METHOD"] == "POST") {
    $name    = htmlspecialchars($_POST["name"]);
    $email   = htmlspecialchars($_POST["email"]);
    $subject = htmlspecialchars($_POST["subject"]);
    $message = htmlspecialchars($_POST["message"]);

    $to      = "amen.ammar123456789@gmail.com"; // Change to your email
    $headers = "From: $email\r\nReply-To: $email\r\nContent-Type: text/plain; charset=UTF-8";
    $body    = "الاسم: $name\nالبريد: $email\nالموضوع: $subject\n\nالرسالة:\n$message";

    if (mail($to, "رسالة جديدة من الموقع: $subject", $body, $headers)) {
        echo "<script>alert('تم إرسال رسالتك بنجاح!'); window.location.href='contact us2.html';</script>";
    } else {
        echo "<script>alert('حدث خطأ أثناء الإرسال. حاول مرة أخرى.'); window.history.back();</script>";
    }
}
?>