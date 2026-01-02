using System.Text.Json.Serialization;

namespace JellyseerrDiscovery.Models;

public class PatchRequestPayload
{
    [JsonPropertyName("contents")]
    public string? Contents { get; set; }
}
