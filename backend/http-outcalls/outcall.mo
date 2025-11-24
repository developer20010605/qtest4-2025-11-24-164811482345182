import Blob "mo:base/Blob";
import Text "mo:base/Text";
import Debug "mo:base/Debug";
import Int "mo:base/Int";
import Time "mo:base/Time";
import Array "mo:base/Array";
import IC "ic:aaaaa-aa";

module {
  public func transform(input : TransformationInput) : TransformationOutput {
    let response = input.response;
    {response with headers = []}
  };

  public type TransformationInput = {
    context : Blob;
    response : IC.http_request_result
  };
  public type TransformationOutput = IC.http_request_result;
  public type Transform = query TransformationInput -> async TransformationOutput;
  public type Header = {name : Text; value : Text};

  let httpRequestCycles = 231_000_000_000;

  public func httpGetRequest(url : Text, extraHeaders : [Header], transform : Transform) : async Text {
    let headers = Array.append(extraHeaders, [{name = "User-Agent"; value = "caffeine.ai"}]);
    let request : IC.http_request_args = {
      url;
      max_response_bytes = null;
      headers;
      body = null;
      method = #get;
      transform = ?{function = transform; context = Blob.fromArray([])};
      is_replicated = ?false
    };
    let response = await (with cycles = httpRequestCycles) IC.http_request(request);
    switch (Text.decodeUtf8(response.body)) {
      case (null) {Debug.trap("empty HTTP response")};
      case (?decoded) {decoded}
    }
  };

  public func httpPostRawRequest(url : Text, extraHeaders : [Header], body : Blob, transform : Transform) : async Text {
    let headers = Array.append(
      extraHeaders,
      [
        {name = "User-Agent"; value = "caffeine.ai"},
        {name = "Idempotency-Key"; value = "Time-" # Int.toText(Time.now())}
      ]
    );
    let request : IC.http_request_args = {
      url;
      max_response_bytes = null;
      headers;
      body = ?body;
      method = #post;
      transform = ?{function = transform; context = Blob.fromArray([])};
      is_replicated = ?false
    };
    let response = await (with cycles = httpRequestCycles) IC.http_request(request);
    switch (Text.decodeUtf8(response.body)) {
      case (null) {Debug.trap("empty HTTP response")};
      case (?decoded) {decoded}
    }
  };

  public func httpPostRequest(url : Text, extraHeaders : [Header], body : Text, transform : Transform) : async Text {
    let encoded = Text.encodeUtf8(body);
    await httpPostRawRequest(url, extraHeaders, encoded, transform)
  }
}
