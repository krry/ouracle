# Swift Testing Quick Reference

## Basic Structure

```swift
import Testing
@testable import souvenir

@Suite("Test Suite Name")
struct MyTests {
    // Properties are initialized once per test
    let dependency: SomeDependency
    
    init() {
        // Setup runs before each test
        dependency = SomeDependency()
    }
    
    @Test("Test description")
    func testName() async throws {
        // Test implementation
        #expect(true)
    }
}
```

## Common Assertions

```swift
// Equality
#expect(value == expected)
#expect(value != unexpected)

// Boolean conditions
#expect(condition)
#expect(!condition)

// Nil checking
#expect(optional != nil)
#expect(optional == nil)

// Unwrapping with message
let unwrapped = try #require(optional, "Optional should not be nil")

// Comparisons
#expect(count > 0)
#expect(count <= maximum)
#expect(array.count == 5)

// Collection checks
#expect(array.contains(item))
#expect(array.isEmpty)
#expect(!array.isEmpty)

// String checks
#expect(string.contains("substring"))
#expect(string.hasPrefix("prefix"))
```

## Parameterized Tests

Test the same logic with multiple inputs:

```swift
@Test("Phone number normalization", arguments: [
    ("(555) 123-4567", "+15551234567"),
    ("555-123-4567", "+15551234567"),
    ("+1 555 123 4567", "+15551234567")
])
func phoneNormalization(input: String, expected: String) {
    let result = PhoneFormatter.normalize(input)
    #expect(result == expected)
}
```

With arrays:

```swift
@Test("Valid emails", arguments: [
    "user@example.com",
    "test.user@domain.co.uk",
    "name+tag@service.com"
])
func validEmails(email: String) {
    #expect(EmailValidator.isValid(email))
}
```

## Test Traits

### Time Limits

```swift
@Test(.timeLimit(.seconds(5)))
func fastOperation() async throws {
    // Must complete within 5 seconds
}

@Test(.timeLimit(.minutes(1)))
func slowOperation() async throws {
    // Must complete within 1 minute
}
```

### Tags

```swift
extension Tag {
    @Tag static var integration: Self
    @Tag static var unit: Self
    @Tag static var critical: Self
    @Tag static var slow: Self
}

@Test(.tags(.integration, .critical))
func criticalIntegrationTest() async throws {
    // Test implementation
}

@Suite(.tags(.unit))
struct UnitTests {
    // All tests in this suite are tagged as unit tests
}
```

Run specific tags:
```bash
swift test --filter tag:integration
swift test --filter tag:unit
```

### Conditional Execution

```swift
// Only run on specific platforms
@Test(.enabled(if: ProcessInfo.processInfo.isiOSAppOnMac))
func macCatalystTest() async throws {
    // Only runs on Mac Catalyst
}

// Skip based on environment
@Test(.disabled("Waiting for API fix in iOS 18.2"))
func pendingTest() async throws {
    // Test is skipped with reason
}
```

## Async Testing

Swift Testing has native async/await support:

```swift
@Test("Async operation completes")
func asyncOperation() async throws {
    let result = await service.fetchData()
    #expect(result.count > 0)
}

@Test("Multiple async operations")
func multipleOperations() async throws {
    async let result1 = service.operation1()
    async let result2 = service.operation2()
    
    let (r1, r2) = await (result1, result2)
    
    #expect(r1.isSuccess)
    #expect(r2.isSuccess)
}
```

## Error Testing

```swift
@Test("Operation throws expected error")
func errorHandling() async throws {
    do {
        _ = try await service.failingOperation()
        Issue.record("Expected error to be thrown")
    } catch let error as ServiceError {
        #expect(error == .invalidInput)
    } catch {
        Issue.record("Unexpected error type: \(error)")
    }
}
```

## Nested Suites

Organize related tests:

```swift
@Suite("Contact Management")
struct ContactTests {
    
    @Suite("Contact Creation")
    struct CreationTests {
        @Test("Create with valid data")
        func validCreation() async throws {
            // Test implementation
        }
    }
    
    @Suite("Contact Search")
    struct SearchTests {
        @Test("Search by name")
        func searchByName() async throws {
            // Test implementation
        }
    }
}
```

## Performance Testing

```swift
@Test("Performance test", .timeLimit(.seconds(1)))
func performanceTest() async throws {
    // This test must complete in under 1 second
    let startTime = Date()
    
    // Perform operation
    await heavyOperation()
    
    let duration = Date().timeIntervalSince(startTime)
    #expect(duration < 0.5, "Operation took \(duration) seconds")
}
```

## Testing with CoreData

```swift
@Suite("Souvenir Data Tests")
struct SouvenirDataTests {
    let persistenceController: PersistenceController
    let viewContext: NSManagedObjectContext
    
    init() {
        // Use in-memory store for testing
        persistenceController = PersistenceController(inMemory: true)
        viewContext = persistenceController.container.viewContext
    }
    
    @Test("Save and fetch souvenir")
    func saveAndFetch() async throws {
        let service = SouvenirService(persistenceController: persistenceController)
        
        let souvenir = try await service.createSouvenir(/* params */)
        #expect(souvenir.id != nil)
        
        let fetched = try await service.fetchSouvenir(id: souvenir.id!)
        #expect(fetched.id == souvenir.id)
    }
}
```

## Custom Expectations

For complex validations:

```swift
func expectValidContact(_ contact: Contact) {
    #expect(contact.givenName.isEmpty == false, "Given name should not be empty")
    #expect(contact.phoneE164.hasPrefix("+"), "Phone should be in E.164 format")
    #expect(contact.displayName.isEmpty == false, "Display name should not be empty")
}

@Test("Contact validation")
func contactValidation() async throws {
    let contact = try await createContact()
    expectValidContact(contact)
}
```

## Recording Custom Issues

```swift
@Test("Complex validation")
func complexValidation() async throws {
    let result = await performComplexOperation()
    
    if !result.isValid {
        Issue.record("Operation result is invalid: \(result.reason)")
    }
    
    guard result.data != nil else {
        Issue.record("Expected data to be present")
        return
    }
    
    #expect(result.data!.count > 0)
}
```

## Running Tests

From Xcode:
- ⌘U - Run all tests
- ^⌥⌘U - Run tests again
- Click diamond icon in gutter to run individual test

From command line:
```bash
# Run all tests
swift test

# Run specific test
swift test --filter SouvenirCaptureTests

# Run with specific tag
swift test --filter tag:integration

# Verbose output
swift test --verbose
```

## Best Practices

1. **Use descriptive test names**: `@Test("Create souvenir with valid contact")`
2. **Keep tests focused**: One behavior per test
3. **Use parameterized tests**: For testing multiple similar cases
4. **Tag appropriately**: Separate unit, integration, and slow tests
5. **Use `#require` for critical unwrapping**: Stops test immediately if nil
6. **Leverage async/await**: No more completion handlers
7. **Keep setup minimal**: Only initialize what's needed for tests
8. **Use in-memory CoreData**: Fast, isolated test data

## Common Patterns

### Testing Optional Results
```swift
let result = await service.findItem(id: itemId)
let item = try #require(result, "Item should be found")
#expect(item.isValid)
```

### Testing Collections
```swift
let items = await service.fetchItems()
#expect(items.count == 3)
#expect(items.allSatisfy { $0.isValid })
#expect(items.contains { $0.isPrimary })
```

### Testing with Dependencies
```swift
@Suite("Service Tests")
struct ServiceTests {
    let mockRepository: MockRepository
    let service: MyService
    
    init() {
        mockRepository = MockRepository()
        service = MyService(repository: mockRepository)
    }
    
    @Test("Service uses repository")
    func usesRepository() async throws {
        await service.performAction()
        #expect(mockRepository.callCount == 1)
    }
}
```

---

## Additional Resources

- [Swift Testing Documentation](https://developer.apple.com/documentation/testing)
- [WWDC 2024: Meet Swift Testing](https://developer.apple.com/videos/play/wwdc2024/10179/)
- [Swift Testing GitHub](https://github.com/apple/swift-testing)
