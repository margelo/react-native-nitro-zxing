#include "BarcodeValueTypeClassifier.hpp"

#include <cctype>

namespace margelo::nitro::camera::zxing {

namespace {

  bool startsWithIgnoreCase(std::string_view text, std::string_view prefix) {
    if (text.size() < prefix.size()) {
      return false;
    }
    for (size_t i = 0; i < prefix.size(); i++) {
      const int textChar = std::tolower(static_cast<unsigned char>(text[i]));
      const int prefixChar = std::tolower(static_cast<unsigned char>(prefix[i]));
      if (textChar != prefixChar) {
        return false;
      }
    }
    return true;
  }

  bool isRetailFormat(BarcodeFormat format) {
    return format == BarcodeFormat::EAN_13 || format == BarcodeFormat::EAN_8 || format == BarcodeFormat::UPC_A || format == BarcodeFormat::UPC_E;
  }

} // namespace

// ponytail: prefix heuristic mirroring ML Kit's value types, no vCard/WiFi/vEvent parsing.
BarcodeValueType classifyValueType(std::string_view text, BarcodeFormat format, ZXing::ContentType contentType) {
  if (contentType == ZXing::ContentType::Binary) {
    return BarcodeValueType::UNKNOWN;
  }
  if (startsWithIgnoreCase(text, "http://") || startsWithIgnoreCase(text, "https://")) {
    return BarcodeValueType::URL;
  }
  if (startsWithIgnoreCase(text, "mailto:") || startsWithIgnoreCase(text, "MATMSG:")) {
    return BarcodeValueType::EMAIL;
  }
  if (startsWithIgnoreCase(text, "tel:")) {
    return BarcodeValueType::PHONE;
  }
  if (startsWithIgnoreCase(text, "smsto:") || startsWithIgnoreCase(text, "sms:")) {
    return BarcodeValueType::SMS;
  }
  if (startsWithIgnoreCase(text, "geo:")) {
    return BarcodeValueType::GEO;
  }
  if (startsWithIgnoreCase(text, "WIFI:")) {
    return BarcodeValueType::WIFI;
  }
  if (startsWithIgnoreCase(text, "BEGIN:VCARD") || startsWithIgnoreCase(text, "MECARD:")) {
    return BarcodeValueType::CONTACT_INFO;
  }
  if (startsWithIgnoreCase(text, "BEGIN:VEVENT") || startsWithIgnoreCase(text, "BEGIN:VCALENDAR")) {
    return BarcodeValueType::CALENDAR_EVENT;
  }
  if (format == BarcodeFormat::PDF_417 && text.starts_with("@\n")) {
    return BarcodeValueType::DRIVER_LICENSE;
  }
  if (format == BarcodeFormat::EAN_13 && (text.starts_with("978") || text.starts_with("979"))) {
    return BarcodeValueType::ISBN;
  }
  if (isRetailFormat(format)) {
    return BarcodeValueType::PRODUCT;
  }
  return BarcodeValueType::TEXT;
}

} // namespace margelo::nitro::camera::zxing
