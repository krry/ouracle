//
//  souvenirTests.swift
//  souvenirTests
//
//  Created by Kerrbear on 14.01.2026.
//

import Testing
@testable import souvenir

@Suite("Souvenir Example Tests")
struct souvenirTests {
    
    init() {
        // Setup code here. This method is called before the invocation of each test method.
    }
    
    @Test("Example test")
    func example() async throws {
        // This is an example of a functional test case.
        // Use #expect to verify your tests produce the correct results.
        // Tests can be marked as async and throws.
        
        #expect(true, "Example expectation")
    }
    
    @Test("Performance example", .timeLimit(.minutes(1)))
    func performanceExample() async throws {
        // This is an example of a performance test case.
        // Swift Testing will automatically measure the time of this test
        
        // Put the code you want to measure the time of here.
        await Task.yield()
    }
}

